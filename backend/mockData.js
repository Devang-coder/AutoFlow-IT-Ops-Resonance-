// ─── MOCK DATA ─────────────────────────────────────────────────────────────────
// Used as fallback when the Neon DB is unavailable.
// Matches the exact shape that the frontend expects.

const incidents = [
  {
    event_id: "evt_mock_001",
    service_name: "payment-service",
    namespace: "production",
    metric_type: "cpu_usage",
    metric_value: 95.4,
    z_score: 3.8,
    anomaly_severity: "critical",
    status: "resolved",
    recorded_at: new Date(Date.now() - 300000).toISOString(),
    consensus_score: 0.82,
    decision: "remediate",
    anomaly_agent_score: 0.85,
    risk_agent_score: 0.88,
    sla_agent_score: 0.76,
    context_agent_score: 0.65,
    anomaly_reasoning: "CPU usage is 3.8 standard deviations above the 1-hour baseline mean of 45%. This constitutes a critical statistical anomaly requiring immediate action.",
    risk_reasoning: "Payment service is a tier-1 dependency. Failure cascades to checkout, order processing, and revenue tracking pipelines.",
    sla_reasoning: "At current trajectory, SLA breach will occur within 4 minutes. Immediate remediation is required to avoid contractual violation.",
    context_reasoning: "No scheduled batch jobs or maintenance windows match this timestamp. Pattern is consistent with a genuine traffic spike or memory leak.",
    action_type: "scale_service",
    action_status: "success",
    mttr_seconds: 8,
    outcome: "recovered",
    recovery_metric_value: 42.1
  },
  {
    event_id: "evt_mock_002",
    service_name: "auth-api",
    namespace: "production",
    metric_type: "error_rate",
    metric_value: 8.3,
    z_score: 2.9,
    anomaly_severity: "high",
    status: "resolved",
    recorded_at: new Date(Date.now() - 600000).toISOString(),
    consensus_score: 0.71,
    decision: "remediate",
    anomaly_agent_score: 0.72,
    risk_agent_score: 0.78,
    sla_agent_score: 0.65,
    context_agent_score: 0.58,
    anomaly_reasoning: "Error rate at 8.3% is significantly above the 0.5% baseline. Z-score of 2.9 confirms this is not normal variance.",
    risk_reasoning: "Auth API is the authentication gateway for all services. Elevated error rate means users cannot log in, impacting entire platform.",
    sla_reasoning: "Error rate SLA is 1%. Current 8.3% constitutes an active SLA violation. MTTR clock started 2 minutes ago.",
    context_reasoning: "No deployment or config change detected in the past 2 hours. Cause appears to be upstream dependency failure.",
    action_type: "restart_pod",
    action_status: "success",
    mttr_seconds: 12,
    outcome: "recovered",
    recovery_metric_value: 0.4
  },
  {
    event_id: "evt_mock_003",
    service_name: "order-processor",
    namespace: "production",
    metric_type: "memory_usage",
    metric_value: 91.7,
    z_score: 2.2,
    anomaly_severity: "medium",
    status: "alerted",
    recorded_at: new Date(Date.now() - 900000).toISOString(),
    consensus_score: 0.44,
    decision: "alert",
    anomaly_agent_score: 0.55,
    risk_agent_score: 0.48,
    sla_agent_score: 0.40,
    context_agent_score: 0.30,
    anomaly_reasoning: "Memory usage trending upward over 20 minutes. Z-score of 2.2 indicates moderate anomaly.",
    risk_reasoning: "Order processor is important but has multiple replicas. Blast radius is limited if one pod is memory-constrained.",
    sla_reasoning: "Current trajectory suggests SLA impact in 25-30 minutes. Not immediately critical but requires monitoring.",
    context_reasoning: "Memory growth pattern is consistent with a slow memory leak. Could be related to the deployment 3 hours ago.",
    action_type: null,
    action_status: null,
    mttr_seconds: null,
    outcome: null,
    recovery_metric_value: null
  }
];

const metrics = {
  events_24h: 47,
  anomalies_24h: 12,
  actions_taken: 9,
  avg_mttr_seconds: 9.4,
  success_rate_percent: 91.7,
  total_incidents: 12
};

const weights = [
  {
    agent_name: "anomaly",
    current_weight: 0.32,
    initial_weight: 0.30,
    total_predictions: 12,
    correct_predictions: 10,
    accuracy_rate: 0.83
  },
  {
    agent_name: "risk",
    current_weight: 0.37,
    initial_weight: 0.35,
    total_predictions: 12,
    correct_predictions: 11,
    accuracy_rate: 0.92
  },
  {
    agent_name: "sla",
    current_weight: 0.22,
    initial_weight: 0.25,
    total_predictions: 12,
    correct_predictions: 9,
    accuracy_rate: 0.75
  },
  {
    agent_name: "context",
    current_weight: 0.09,
    initial_weight: 0.10,
    total_predictions: 12,
    correct_predictions: 7,
    accuracy_rate: 0.58
  }
];

module.exports = { incidents, metrics, weights };
