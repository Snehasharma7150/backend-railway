/**
 * src/routes/webhooks.js
 * POST /webhooks/salesforce  — receives Salesforce Outbound Messages or Platform Events
 * POST /webhooks/zendesk     — receives Zendesk webhook (ticket updated)
 *
 * These run OUTSIDE the requireAppSecret middleware because they come
 * from Salesforce/Zendesk, not from the sidebar. Add your own
 * signature validation here for production.
 */

const express = require("express");
const router  = express.Router();
const sync    = require("../services/sync");
const maps    = require("../db/mappings");

// Salesforce Outbound Message (XML) or Platform Event (JSON)
router.post("/salesforce", async (req, res) => {
  const body = req.body;

  // Platform Event shape: { type, sfId }
  // Adjust to match your actual event schema
  const eventType = body.type || "unknown";
  const sfId      = body.sfId || body.Id;

  if (!sfId) {
    return res.status(400).json({ error: "Missing sfId in payload" });
  }

  try {
    if (eventType === "Case" || body.CaseNumber) {
      await sync.syncCase(sfId);
    } else if (eventType === "Account") {
      await sync.syncAccount(sfId);
    } else if (eventType === "Contact") {
      await sync.syncContact(sfId);
    } else {
      return res.status(400).json({ error: "Unknown event type: " + eventType });
    }

    res.json({ ok: true });
  } catch (err) {
    maps.syncLog.write(eventType + "_webhook", sfId, null, "error", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Zendesk webhook — ticket status changes pushed back to Salesforce
router.post("/zendesk", async (req, res) => {
  const { ticket_id, status } = req.body;

  if (!ticket_id) {
    return res.status(400).json({ error: "Missing ticket_id" });
  }

  const mapping = maps.caseTicket.findByZdId(Number(ticket_id));
  if (!mapping) {
    return res.status(404).json({ error: "No SF Case mapping for ticket " + ticket_id });
  }

  // TODO: push status back to Salesforce via sf.updateCase(mapping.sf_case_id, { Status: status })
  // For now we log it
  maps.syncLog.write("zd_webhook", mapping.sf_case_id, String(ticket_id), "received");
  res.json({ ok: true, sfCaseId: mapping.sf_case_id });
});

module.exports = router;
