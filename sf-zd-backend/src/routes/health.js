/**
 * src/routes/health.js
 * GET /health — simple liveness check (no auth required)
 */
const express = require("express");
const router  = express.Router();
const maps    = require("../db/mappings");

router.get("/", (_req, res) => {
  const recentLogs = maps.syncLog.recent(5);
  res.json({ ok: true, uptime: process.uptime(), recentSyncs: recentLogs });
});

module.exports = router;
