// db/connection.js
console.log("ENV PASSWORD:", process.env.NEON_PASSWORD);
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.NEON_HOST,
  database: process.env.NEON_DB,
  user: process.env.NEON_USER,
  password: process.env.NEON_PASSWORD,
  port: process.env.NEON_PORT || 5432,

  ssl: {
    rejectUnauthorized: false, // REQUIRED for Neon
  },

  connectionTimeoutMillis: 30000,
});

pool.on("connect", () => {
  console.log(" Connected to NeonDB");
});

pool.on("error", (err) => {
  console.error(" Unexpected DB error:", err);
});

// Test connection once
(async () => {
  try {
    const res = await pool.query("SELECT NOW()");
    console.log(" DB Time:", res.rows[0].now);
  } catch (err) {
    console.error("DB Connection Failed:", err.message);
  }
})();

module.exports = pool;