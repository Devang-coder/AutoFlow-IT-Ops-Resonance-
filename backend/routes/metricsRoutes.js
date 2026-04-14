const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const mock = require("../mockData");

// GET /metrics — dashboard header KPIs
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
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

    res.json(result.rows[0]);
  } catch (err) {
    console.log("DB unavailable — using mock metrics:", err.message);
    res.json(mock.metrics);
  }
});

module.exports = router;
