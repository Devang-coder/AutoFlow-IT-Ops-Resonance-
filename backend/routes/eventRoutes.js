const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const socket = require("../socket");

router.post("/", async (req, res) => {
  const {
    event_id,
    service_name,
    namespace = "default",
    metric_type,
    metric_value,
    is_anomaly = false,
    z_score = 0,
    anomaly_severity = "none",
    confidence = 0,
    status = "detected"
  } = req.body;

  if (!event_id || !service_name || !metric_type || metric_value === undefined) {
    return res.status(400).json({
      error: "Missing required fields"
    });
  }

  try {
    await pool.query(
      `INSERT INTO autoflow_events
       (event_id, service_name, namespace, metric_type, metric_value,
        is_anomaly, z_score, anomaly_severity, confidence, status, recorded_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       ON CONFLICT (event_id) DO NOTHING;`,
      [event_id, service_name, namespace, metric_type, metric_value,
       is_anomaly, z_score, anomaly_severity, confidence, status]
    );

    // Emit FLAT incident payload so frontend can map directly
    const payload = {
      event_id,
      service_name,
      namespace,
      metric_type,
      metric_value,
      z_score,
      anomaly_severity,
      confidence,
      status,
      recorded_at: new Date().toISOString()
    };

    socket.getIO().emit("incident_update", payload);

    // Emit refreshed metrics
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
    } catch (metricErr) {
      console.error("Failed to emit metrics", metricErr);
    }

    res.json({ success: true, event_id });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Event failed" });
  }
});

module.exports = router;