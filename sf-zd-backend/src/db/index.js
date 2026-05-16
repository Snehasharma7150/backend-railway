/**
 * src/db/index.js
 * Opens (or creates) the SQLite database and exports a singleton.
 * better-sqlite3 is synchronous — no await needed for queries.
 */

const path     = require("path");
const fs       = require("fs");
const Database = require("better-sqlite3");

const dbPath = process.env.DB_PATH || "./data/mappings.db";
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

module.exports = db;
