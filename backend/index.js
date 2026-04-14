require("dotenv").config();
const express = require("express");
const cors = require("cors");

// Frontend-facing routes
const incidentRoutes = require("./routes/incidentRoutes");
const metricsRoutes  = require("./routes/metricsRoutes");
const weightsRoutes  = require("./routes/weightsRoutes");
const simulateRoutes = require("./routes/simulateRoutes");

// n8n ingest routes (called by Workflows 1, 2, 4)
const eventRoutes    = require("./routes/eventRoutes");
const decisionRoutes = require("./routes/decisionRoutes");
const actionRoutes   = require("./routes/actionRoutes");

// Socket.io
const http   = require("http");
const socket = require("./socket");

const app    = express();
const server = http.createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Socket.io
socket.init(server);

// Health check
app.get("/", (req, res) => {
  res.json({
    status:    "ok",
    service:   "AutoFlow Backend",
    timestamp: new Date().toISOString(),
    endpoints: {
      frontend: ["GET /incidents", "GET /metrics", "GET /weights", "POST /simulate"],
      n8n:      ["POST /event", "POST /decision", "POST /action"]
    }
  });
});

// Frontend routes
app.use("/incidents", incidentRoutes);
app.use("/metrics",   metricsRoutes);
app.use("/weights",   weightsRoutes);
app.use("/simulate",  simulateRoutes);

// n8n ingest routes
app.use("/event",    eventRoutes);
app.use("/decision", decisionRoutes);
app.use("/action",   actionRoutes);

// Start
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`AutoFlow Backend running on http://localhost:${PORT}`);
});
