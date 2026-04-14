const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const socket = require("../socket");

router.post("/", async (req, res) => {
  const d = req.body;

  if (!d.decision_id || !d.event_id || d.consensus_score === undefined || !d.decision) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    await pool.query(
      `INSERT INTO autoflow_decisions
       (decision_id, event_id, consensus_score, decision, remediation_action,
        anomaly_agent_score, risk_agent_score, sla_agent_score, context_agent_score,
        anomaly_reasoning, risk_reasoning, sla_reasoning, context_reasoning,
        weights_used, decided_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
       ON CONFLICT (decision_id) DO NOTHING;`,
      [
        d.decision_id,
        d.event_id,
        d.consensus_score,
        d.decision,
        d.remediation_action,
        d.anomaly_agent_score,
        d.risk_agent_score,
        d.sla_agent_score,
        d.context_agent_score,
        d.anomaly_reasoning,
        d.risk_reasoning,
        d.sla_reasoning,
        d.context_reasoning,
        JSON.stringify(d.weights_used || {})
      ]
    );

    const newStatus =
      d.decision === "remediate" ? "remediating" :
      d.decision === "alert" ? "alerted" :
      "ignored";

    await pool.query(
      `UPDATE autoflow_events SET status = $1 WHERE event_id = $2`,
      [newStatus, d.event_id]
    );

    // Fetch the full incident record to emit a complete flat payload
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
      `, [d.event_id]);

      if (fullResult.rows[0]) {
        socket.getIO().emit("incident_update", fullResult.rows[0]);
      }
    } catch (fetchErr) {
      // Fallback: emit what we have
      socket.getIO().emit("incident_update", {
        ...d,
        status: newStatus
      });
    }

    // Emit updated metrics
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
    } catch (metricErr) { }

    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Decision failed" });
  }
});

module.exports = router;