/**
 * scripts/migrate.js
 * Run once: `npm run migrate`
 * Creates the SQLite tables that store SF <-> Zendesk ID mappings.
 */

require("dotenv").config();
const path   = require("path");
const fs     = require("fs");
const Database = require("better-sqlite3");

const dbPath = process.env.DB_PATH || "./data/mappings.db";
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
  -- Account (SF) <-> Organization (Zendesk)
  CREATE TABLE IF NOT EXISTS account_org_map (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sf_account_id    TEXT NOT NULL UNIQUE,
    zd_org_id        INTEGER NOT NULL UNIQUE,
    sf_account_name  TEXT,
    synced_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Contact (SF) <-> User/Requester (Zendesk)
  CREATE TABLE IF NOT EXISTS contact_user_map (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sf_contact_id    TEXT NOT NULL UNIQUE,
    zd_user_id       INTEGER NOT NULL UNIQUE,
    email            TEXT NOT NULL,
    sf_account_id    TEXT,
    synced_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Case (SF) <-> Ticket (Zendesk)
  CREATE TABLE IF NOT EXISTS case_ticket_map (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sf_case_id       TEXT NOT NULL UNIQUE,
    sf_case_number   TEXT,
    zd_ticket_id     INTEGER UNIQUE,
    sf_account_id    TEXT,
    sf_contact_id    TEXT,
    synced_at        TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Sync log — one row per sync event for debugging
  CREATE TABLE IF NOT EXISTS sync_log (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type       TEXT NOT NULL,
    sf_id            TEXT,
    zd_id            TEXT,
    status           TEXT NOT NULL,
    error            TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.close();
console.log("Migration complete:", dbPath);
