/**
 * src/db/mappings.js
 * All read/write helpers for the three mapping tables.
 * Keeps SQL out of service files.
 */

const db = require("./index");

// ── Account <-> Org ──────────────────────────────────────────────

const accountOrg = {
  findBySfId(sfAccountId) {
    return db.prepare(
      "SELECT * FROM account_org_map WHERE sf_account_id = ?"
    ).get(sfAccountId);
  },

  findByZdId(zdOrgId) {
    return db.prepare(
      "SELECT * FROM account_org_map WHERE zd_org_id = ?"
    ).get(zdOrgId);
  },

  upsert(sfAccountId, zdOrgId, sfAccountName) {
    db.prepare(`
      INSERT INTO account_org_map (sf_account_id, zd_org_id, sf_account_name, synced_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(sf_account_id) DO UPDATE SET
        zd_org_id       = excluded.zd_org_id,
        sf_account_name = excluded.sf_account_name,
        synced_at       = excluded.synced_at
    `).run(sfAccountId, zdOrgId, sfAccountName);
  },
};

// ── Contact <-> User ─────────────────────────────────────────────

const contactUser = {
  findBySfId(sfContactId) {
    return db.prepare(
      "SELECT * FROM contact_user_map WHERE sf_contact_id = ?"
    ).get(sfContactId);
  },

  findByEmail(email) {
    return db.prepare(
      "SELECT * FROM contact_user_map WHERE email = ?"
    ).get(email);
  },

  upsert(sfContactId, zdUserId, email, sfAccountId) {
    db.prepare(`
      INSERT INTO contact_user_map (sf_contact_id, zd_user_id, email, sf_account_id, synced_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(sf_contact_id) DO UPDATE SET
        zd_user_id    = excluded.zd_user_id,
        email         = excluded.email,
        sf_account_id = excluded.sf_account_id,
        synced_at     = excluded.synced_at
    `).run(sfContactId, zdUserId, email, sfAccountId);
  },
};

// ── Case <-> Ticket ──────────────────────────────────────────────

const caseTicket = {
  findBySfId(sfCaseId) {
    return db.prepare(
      "SELECT * FROM case_ticket_map WHERE sf_case_id = ?"
    ).get(sfCaseId);
  },

  findByZdId(zdTicketId) {
    return db.prepare(
      "SELECT * FROM case_ticket_map WHERE zd_ticket_id = ?"
    ).get(zdTicketId);
  },

  upsert(sfCaseId, sfCaseNumber, zdTicketId, sfAccountId, sfContactId) {
    db.prepare(`
      INSERT INTO case_ticket_map
        (sf_case_id, sf_case_number, zd_ticket_id, sf_account_id, sf_contact_id, synced_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(sf_case_id) DO UPDATE SET
        sf_case_number = excluded.sf_case_number,
        zd_ticket_id   = excluded.zd_ticket_id,
        sf_account_id  = excluded.sf_account_id,
        sf_contact_id  = excluded.sf_contact_id,
        synced_at      = excluded.synced_at
    `).run(sfCaseId, sfCaseNumber, zdTicketId, sfAccountId, sfContactId);
  },
};

// ── Sync log ─────────────────────────────────────────────────────

const syncLog = {
  write(eventType, sfId, zdId, status, error = null) {
    db.prepare(`
      INSERT INTO sync_log (event_type, sf_id, zd_id, status, error)
      VALUES (?, ?, ?, ?, ?)
    `).run(eventType, sfId, zdId, status, error);
  },

  recent(limit = 50) {
    return db.prepare(
      "SELECT * FROM sync_log ORDER BY created_at DESC LIMIT ?"
    ).all(limit);
  },
};

module.exports = { accountOrg, contactUser, caseTicket, syncLog };
