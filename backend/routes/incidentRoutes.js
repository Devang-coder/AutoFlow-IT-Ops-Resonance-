const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const mock = require("../mockData");

// GET /incidents — frontend polling endpoint
// Returns full incident lifecycle: event + decision + action
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        e.event_id,
        e.service_name,
        e.namespace,
        e.metric_type,
        e.metric_value,
        e.z_score,
        e.anomaly_severity,
        e.status,
        e.recorded_at,
        d.consensus_score,
        d.decision,
        d.anomaly_agent_score,
        d.risk_agent_score,
        d.sla_agent_score,
        d.context_agent_score,
        d.anomaly_reasoning,
        d.risk_reasoning,
        d.sla_reasoning,
        d.context_reasoning,
        a.action_type,
        a.action_status,
        a.mttr_seconds,
        a.outcome,
        a.recovery_metric_value
      FROM autoflow_events e
      LEFT JOIN autoflow_decisions d ON e.event_id = d.event_id
      LEFT JOIN autoflow_actions a ON d.decision_id = a.decision_id
      WHERE e.is_anomaly = true
      ORDER BY e.recorded_at DESC
      LIMIT 50;
    `);

    res.json(result.rows);
  } catch (err) {
    console.log("DB unavailable — using mock incidents:", err.message);
    res.json(mock.incidents);
  }
});

module.exports = router;
