const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const socket = require("../socket");

router.post("/", async (req, res) => {
  const {
    action_id,
    decision_id,
    action_type,
    action_status,
    outcome = null,
    recovery_metric_value = null,
    mttr_seconds = null
  } = req.body;

  if (!action_id || !decision_id || !action_type || !action_status) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await pool.query(
      `INSERT INTO autoflow_actions
       (action_id, decision_id, action_type, action_status,
        outcome, recovery_metric_value, mttr_seconds,
        executed_at, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),
         CASE WHEN $4 IN ('success','failed') THEN NOW() ELSE NULL END)
       ON CONFLICT (action_id) DO UPDATE
       SET action_status = EXCLUDED.action_status,
           outcome = EXCLUDED.outcome,
           recovery_metric_value = EXCLUDED.recovery_metric_value,
           mttr_seconds = EXCLUDED.mttr_seconds;`,
      [action_id, decision_id, action_type, action_status,
       outcome, recovery_metric_value, mttr_seconds]
    );

    // Get event_id from the decision
    const result = await pool.query(
      `SELECT event_id FROM autoflow_decisions WHERE decision_id = $1`,
      [decision_id]
    );

    const event_id = result.rows[0]?.event_id;

    const finalStatus =
      action_status === "success" ? "resolved" :
      action_status === "failed" ? "escalated" :
      "remediating";

    await pool.query(
      `UPDATE autoflow_events SET status = $1 WHERE event_id = $2`,
      [finalStatus, event_id]
    );

    // Fetch the full incident record to emit complete flat payload
    try {
      const fullResult = await pool.query(`
        SELECT
          e.event_id, e.service_name, e.namespace, e.metric_type, e.metric_value,
          e.z_score, e.anomaly_severity, e.status, e.recorded_at,
          d.consensus_score, d.decision,
          d.anomaly_agent_score, d.risk_agent_score, d.sla_agent_score, d.context_agent_score,
          d.anomaly_reasoning, d.risk_reasoning, d.sla_reasoning, d.context_reasoning,
          a.action_type, a.action_status, a.mttr_seconds, a.outcome, a.recovery_metric_value
        FROM autoflow_events e
        LEFT JOIN autoflow_decisions d ON e.event_id = d.event_id
        LEFT JOIN autoflow_actions a ON d.decision_id = a.decision_id
        WHERE e.event_id = $1
      `, [event_id]);

      if (fullResult.rows[0]) {
        socket.getIO().emit("incident_update", fullResult.rows[0]);
      }
    } catch (fetchErr) {
      // Fallback
      socket.getIO().emit("incident_update", {
        action_id, decision_id, event_id,
        action_type, action_status,
        outcome, recovery_metric_value, mttr_seconds,
        status: finalStatus
      });
    }

    // Emit updated metrics + weights
    try {
      const metricsRes = await pool.query(`
        SELECT
          COUNT(DISTINCT e.event_id)                                    AS events_24h,
          COUNT(DISTINCT CASE WHEN e.is_anomaly THEN e.event_id END)    AS anomalies_24h,
          COUNT(DISTINCT a.action_id)                                   AS actions_taken,
          ROUND(AVG(a.mttr_seconds)::NUMERIC, 1)                       AS avg_mttr_seconds,
          ROUND(
            100.0 * COUNT(CASE WHEN a.action_status = 'success' THEN 1 END)
            / NULLIF(COUNT(a.action_id), 0)
          , 1)                                                          AS success_rate_percent
        FROM autoflow_events e
        LEFT JOIN autoflow_decisions d ON e.event_id = d.event_id
        LEFT JOIN autoflow_actions   a ON d.decision_id = a.decision_id
        WHERE e.recorded_at >= NOW() - INTERVAL '24 hours';
      `);
      socket.getIO().emit("metrics_update", metricsRes.rows[0]);
      
      const weightsRes = await pool.query(`
        SELECT
          agent_name,
          current_weight,
          initial_weight,
          total_predictions,
          correct_predictions,
          ROUND(accuracy_rate::NUMERIC, 3) AS accuracy_rate
        FROM autoflow_agent_weights
        ORDER BY current_weight DESC;
      `);
      socket.getIO().emit("weights_update", weightsRes.rows);
    } catch (metricErr) { }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Action failed" });
  }
});

module.exports = router;