/**
 * src/routes/cases.js
 *
 * GET  /cases/by-email/:email        — find latest SF Case by requester email (auto)
 * POST /cases/by-email/:email/sync   — manual sync trigger from sidebar
 * GET  /cases/:sfCaseId              — fetch by explicit SF Case ID (kept for compatibility)
 */

const express = require("express");
const router  = express.Router();
const sync    = require("../services/sync");
const sf      = require("../services/salesforce");

// ── Auto lookup by email ──────────────────────────────────────────

// GET /cases/by-email/:email
// Called automatically when agent opens any ticket.
// Finds the most recent open SF Case linked to the requester's email.
router.get("/by-email/:email", async (req, res) => {
  const { email } = req.params;

  // 1. Find SF Case by email
  const sfCase = await sf.getCaseByEmail(email);

  if (!sfCase) {
    return res.status(404).json({
      message: "No Salesforce case found for email: " + email,
    });
  }

  // 2. Build the full sidebar payload
  const payload = await sync.buildCasePayloadFromCase(sfCase);
  res.json(payload);
});

// POST /cases/by-email/:email/sync
// "Sync now" button — re-syncs and returns fresh data
router.post("/by-email/:email/sync", async (req, res) => {
  const { email } = req.params;

  const sfCase = await sf.getCaseByEmail(email);
  if (!sfCase) {
    return res.status(404).json({
      message: "No Salesforce case found for email: " + email,
    });
  }

  await sync.syncCase(sfCase.Id);
  const payload = await sync.buildCasePayloadFromCase(sfCase);
  res.json({ ok: true, data: payload });
});

// ── Explicit Case ID lookup (kept for compatibility) ──────────────

// GET /cases/:sfCaseId
router.get("/:sfCaseId", async (req, res) => {
  const { sfCaseId } = req.params;
  const payload = await sync.buildCasePayload(sfCaseId);
  res.json(payload);
});

module.exports = router;
