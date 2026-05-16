/**
 * src/webhooks/zendesk.js
 * Receives ticket update events from Zendesk and writes status/comments
 * back to the linked Salesforce Case.
 *
 * Setup in Zendesk:
 *   Admin Centre → Apps & Integrations → Webhooks → Create webhook
 *   Endpoint: https://your-backend.com/webhooks/zendesk/ticket-updated
 *   Trigger: Ticket → Updated / Solved / Commented
 *
 * Zendesk sends a JSON payload (configure in the webhook body template).
 */

const express = require("express");
const router  = express.Router();
const db      = require("../db/client");
const sf      = require("../services/salesforce");

/* ── POST /webhooks/zendesk/ticket-updated ───────────────────── */
// Expected Zendesk webhook body template (configure this in Zendesk):
// {
//   "ticket_id":     "{{ticket.id}}",
//   "ticket_status": "{{ticket.status}}",
//   "ticket_title":  "{{ticket.title}}",
//   "comment":       "{{ticket.latest_comment_html}}",
//   "updater_email": "{{current_user.email}}",
//   "updater_name":  "{{current_user.name}}"
// }

router.post("/ticket-updated", async (req, res) => {
  const { ticket_id, ticket_status, comment, updater_name } = req.body;

  if (!ticket_id) {
    return res.status(400).json({ error: "Missing ticket_id" });
  }

  // Look up the Salesforce Case ID from our mapping table
  const mapping = db.prepare(
    "SELECT sf_case_id FROM case_ticket_map WHERE zd_ticket_id = ?"
  ).get(Number(ticket_id));

  if (!mapping) {
    // No mapping = not a synced ticket; ignore silently
    return res.json({ ok: true, action: "no-mapping-ignored" });
  }

  try {
    const sfFields = {};

    // Map Zendesk status back to Salesforce Case status
    const statusMap = {
      new:     "New",
      open:    "In Progress",
      pending: "Waiting on Customer",
      "on-hold": "Waiting on Third Party",
      solved:  "Closed",
      closed:  "Closed",
    };

    if (ticket_status && statusMap[ticket_status]) {
      sfFields.Status = statusMap[ticket_status];
    }

    // Append a comment to the Salesforce Case if one was added in Zendesk
    if (comment) {
      // Strip HTML tags for Salesforce plain-text comment
      const plainComment = comment.replace(/<[^>]+>/g, "").trim();
      if (plainComment) {
        sfFields.Description = `[Zendesk update by ${updater_name || "agent"}]: ${plainComment}`;
      }
    }

    if (Object.keys(sfFields).length) {
      await sf.updateCase(mapping.sf_case_id, sfFields);
    }

    res.json({ ok: true, sfCaseId: mapping.sf_case_id });
  } catch (err) {
    console.error("[ZD Webhook] SF update failed:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
