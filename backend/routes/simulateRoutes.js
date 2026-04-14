const express = require("express");
const router = express.Router();
const axios = require("axios");
const socket = require("../socket");
const mock = require("../mockData");

// Type-to-payload mapping for the frontend simulation buttons
const typePayloads = {
  cpu: { service_name: "api-gateway", metric_type: "cpu_usage", metric_value: +(Math.random() * 10 + 90).toFixed(1), namespace: "production" },
  disk: { service_name: "data-store", metric_type: "disk_usage", metric_value: +(Math.random() * 14 + 85).toFixed(1), namespace: "production" },
  pod: { service_name: "order-processor", metric_type: "error_rate", metric_value: +(Math.random() * 8 + 5).toFixed(1), namespace: "production" },
};

// POST /simulate — demo button trigger
// Sends a fake telemetry spike to n8n, which kicks off the full pipeline.
// Falls back gracefully if n8n is not running.
router.post("/", async (req, res) => {
  // Support both {type: "cpu"} from frontend and explicit payloads
  const simType = req.body?.type || "cpu";
  const defaults = typePayloads[simType] || typePayloads.cpu;

  const payload = {
    service_name: req.body?.service_name || defaults.service_name,
    metric_type:  req.body?.metric_type  || defaults.metric_type,
    metric_value: req.body?.metric_value ?? defaults.metric_value,
    namespace:    req.body?.namespace    || defaults.namespace,
    source:       "simulate_button"
  };

  try {
    const n8nUrl = process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/autoflow/telemetry";
    await axios.post(n8nUrl, payload, { timeout: 5000 });

    socket.getIO().emit("simulation_triggered", {
      status: "live",
      message: "Incident simulation sent to AutoFlow pipeline",
      payload
    });

    res.json({
      success: true,
      message: "Simulation triggered — AutoFlow pipeline running",
      payload
    });

  } catch (err) {
    // n8n not running — run a full mock incident lifecycle so the UI shows up live
    const eventId = `evt_sim_${Date.now()}`;
    const io = socket.getIO();

    // PHASE 1: Detected
    const baseIncident = {
      event_id:         eventId,
      service_name:     payload.service_name,
      namespace:        payload.namespace,
      metric_type:      payload.metric_type,
      metric_value:     payload.metric_value,
      z_score:          +(Math.random() * 2 + 2.5).toFixed(1),
      anomaly_severity: payload.metric_value > 90 ? "critical" : "high",
      status:           "detected",
      recorded_at:      new Date().toISOString(),
      consensus_score:  null,
      decision:         null,
      anomaly_agent_score: null,
      risk_agent_score:    null,
      sla_agent_score:     null,
      context_agent_score: null,
      anomaly_reasoning:   null,
      risk_reasoning:      null,
      sla_reasoning:       null,
      context_reasoning:   null,
      action_type:         null,
      action_status:       null,
      mttr_seconds:        null,
      outcome:             null,
      recovery_metric_value: null
    };

    io.emit("incident_update", baseIncident);

    // PHASE 2: Evaluating (after 1.5s)
    setTimeout(() => {
      const evaluating = {
        ...baseIncident,
        status:           "evaluating",
        consensus_score:  0.81,
        decision:         "remediate",
        anomaly_agent_score: 0.85,
        risk_agent_score:    0.87,
        sla_agent_score:     0.78,
        context_agent_score: 0.62,
        anomaly_reasoning:   `${payload.metric_type} at ${payload.metric_value} is ${baseIncident.z_score} standard deviations above baseline. Critical anomaly confirmed.`,
        risk_reasoning:      `${payload.service_name} is a tier-1 dependency. Remediation required to protect pipeline.`,
        sla_reasoning:       `At current trajectory, SLA breach projected within 3 minutes.`,
        context_reasoning:   `Manual simulation trigger. No scheduled job matches this pattern.`
      };
      io.emit("incident_update", evaluating);

      // PHASE 3: Remediating (after 3s total)
      setTimeout(() => {
        const remediating = {
          ...evaluating,
          status:        "remediating",
          action_type:   "scale_service",
          action_status: "executing"
        };
        io.emit("incident_update", remediating);

        // PHASE 4: Resolved (after 5s total)
        setTimeout(() => {
          const resolved = {
            ...remediating,
            status:        "resolved",
            action_status: "success",
            mttr_seconds:  +(Math.random() * 5 + 4).toFixed(1),
            outcome:       "recovered",
            recovery_metric_value: +(payload.metric_value * 0.4).toFixed(1)
          };
          io.emit("incident_update", resolved);

          // Also emit updated metrics & weights
          io.emit("metrics_update", {
            events_24h:           mock.metrics.events_24h + 1,
            anomalies_24h:        mock.metrics.anomalies_24h + 1,
            actions_taken:        mock.metrics.actions_taken + 1,
            avg_mttr_seconds:     resolved.mttr_seconds,
            success_rate_percent: mock.metrics.success_rate_percent
          });

          io.emit("weights_update", mock.weights.map(w => ({
            ...w,
            current_weight: +(w.current_weight + (Math.random() * 0.02 - 0.01)).toFixed(3),
            total_predictions: w.total_predictions + 1,
            correct_predictions: w.correct_predictions + (Math.random() > 0.2 ? 1 : 0)
          })));
        }, 2000);
      }, 1500);
    }, 1500);

    io.emit("simulation_triggered", {
      status: "mock",
      message: "Mock simulation — full lifecycle (n8n not connected)",
      payload
    });

    res.json({
      success: true,
      message: "Mock simulation running — full lifecycle via WebSocket",
      note: err.message
    });
  }
});

module.exports = router;
