/**
 * src/db/init.js
 * Run once: `npm run db:init`
 * Creates the SQLite database and all mapping tables.
 */

const Database = require("better-sqlite3");
const path     = require("path");
const fs       = require("fs");
require("dotenv").config();

const DB_PATH = process.env.DB_PATH || "./data/mappings.db";

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  /* ── Account ↔ Organization ───────────────────────────── */
  CREATE TABLE IF NOT EXISTS account_org_map (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sf_account_id    TEXT    NOT NULL UNIQUE,
    zd_org_id        INTEGER NOT NULL UNIQUE,
    sf_account_name  TEXT,
    last_synced_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  /* ── Contact ↔ User ───────────────────────────────────── */
  CREATE TABLE IF NOT EXISTS contact_user_map (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sf_contact_id    TEXT    NOT NULL UNIQUE,
    zd_user_id       INTEGER NOT NULL UNIQUE,
    email            TEXT    NOT NULL,
    sf_account_id    TEXT,
    last_synced_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sf_account_id) REFERENCES account_org_map(sf_account_id)
  );

  /* ── Case ↔ Ticket ────────────────────────────────────── */
  CREATE TABLE IF NOT EXISTS case_ticket_map (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    sf_case_id       TEXT    NOT NULL UNIQUE,
    zd_ticket_id     INTEGER NOT NULL UNIQUE,
    sf_case_number   TEXT,
    sf_account_id    TEXT,
    sf_contact_id    TEXT,
    last_synced_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sf_account_id) REFERENCES account_org_map(sf_account_id),
    FOREIGN KEY (sf_contact_id) REFERENCES contact_user_map(sf_contact_id)
  );

  /* ── Sync log ─────────────────────────────────────────── */
  CREATE TABLE IF NOT EXISTS sync_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,   -- 'case' | 'account' | 'contact'
    entity_id   TEXT NOT NULL,
    direction   TEXT NOT NULL,   -- 'sf_to_zd' | 'zd_to_sf'
    status      TEXT NOT NULL,   -- 'ok' | 'error'
    message     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_sync_log_entity ON sync_log(entity_type, entity_id);
  CREATE INDEX IF NOT EXISTS idx_case_ticket_sf  ON case_ticket_map(sf_case_id);
  CREATE INDEX IF NOT EXISTS idx_case_ticket_zd  ON case_ticket_map(zd_ticket_id);
`);

console.log("✅  Database initialised at", path.resolve(DB_PATH));
db.close();
