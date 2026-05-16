/**
 * src/webhooks/salesforce.js
 * Receives real-time events from Salesforce and triggers syncs.
 *
 * Salesforce can push events two ways:
 *   A) Outbound Messages (SOAP) — legacy, no extra setup in SF
 *   B) Platform Events / Change Data Capture — modern, requires SF setup
 *
 * This file handles BOTH. Configure whichever you prefer in Salesforce.
 */

const express = require("express");
const router  = express.Router();
const sync    = require("../services/sync");

/* ── A) Platform Events / CDC (JSON POST) ────────────────────── */
// In Salesforce: Setup → Flows or Apex Triggers → HTTP POST to this URL
// Or: use a Salesforce-to-Heroku / MuleSoft relay for Platform Events.
//
// Expected body:
// {
//   "eventType": "CaseChange" | "AccountChange" | "ContactChange",
//   "recordId": "500xx000001xxxxAAA",
//   "changeType": "CREATE" | "UPDATE" | "DELETE"
// }

router.post("/platform-event", async (req, res) => {
  const { eventType, recordId, changeType } = req.body;

  if (!recordId || !eventType) {
    return res.status(400).json({ error: "Missing eventType or recordId" });
  }

  if (changeType === "DELETE") {
    // TODO: handle deletions (archive ticket, etc.)
    return res.json({ ok: true, action: "delete-ignored" });
  }

  try {
    if (eventType === "CaseChange") {
      await sync.syncCase(recordId);
    } else if (eventType === "AccountChange") {
      await sync.syncAccount(recordId);
    } else if (eventType === "ContactChange") {
      await sync.syncContact(recordId);
    } else {
      return res.status(400).json({ error: `Unknown eventType: ${eventType}` });
    }

    res.json({ ok: true, synced: recordId });
  } catch (err) {
    console.error("[SF Webhook] Sync failed:", err.message);
    // Return 200 so Salesforce does not retry endlessly;
    // the error is already logged to sync_log table.
    res.json({ ok: false, error: err.message });
  }
});

/* ── B) Outbound Messages (SOAP/XML) ─────────────────────────── */
// In Salesforce: Setup → Workflow Rules or Process Builder → Outbound Message
// Set endpoint URL to: https://your-backend.com/webhooks/salesforce/outbound-message
//
// This parser handles Case outbound messages. Adapt the XML field names
// to match what you configure in the Salesforce Outbound Message definition.

router.post("/outbound-message", express.text({ type: "text/xml" }), async (req, res) => {
  const body = req.body || "";

  // Minimal XML parse — extract CaseId without a full XML parser dependency.
  // For production, swap this for the 'fast-xml-parser' npm package.
  const idMatch   = body.match(/<sf:Id>([^<]+)<\/sf:Id>/);
  const typeMatch = body.match(/<sf:Type>([^<]+)<\/sf:Type>/);

  if (!idMatch) {
    return res.status(400).send(ackSoap("error: missing Id"));
  }

  const recordId   = idMatch[1];
  const recordType = typeMatch?.[1] || "Case";

  try {
    if (recordType === "Case") {
      await sync.syncCase(recordId);
    } else if (recordType === "Account") {
      await sync.syncAccount(recordId);
    } else if (recordType === "Contact") {
      await sync.syncContact(recordId);
    }

    // Salesforce requires a specific SOAP ACK response
    res.set("Content-Type", "text/xml").send(ackSoap("ok"));
  } catch (err) {
    console.error("[SF Outbound Message] Sync failed:", err.message);
    res.set("Content-Type", "text/xml").send(ackSoap("error: " + err.message));
  }
});

function ackSoap(message) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
  <soapenv:Body>
    <notificationsResponse xmlns="http://soap.sforce.com/2005/09/outbound">
      <Ack>true</Ack>
      <!-- ${message} -->
    </notificationsResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
}

module.exports = router;
