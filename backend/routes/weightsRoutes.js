const express = require("express");
const router = express.Router();
const pool = require("../db/connection");
const mock = require("../mockData");

// GET /weights — agent weight panel (learning visualization)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
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

    res.json(result.rows);
  } catch (err) {
    console.log("DB unavailable — using mock weights:", err.message);
    res.json(mock.weights);
  }
});

module.exports = router;
