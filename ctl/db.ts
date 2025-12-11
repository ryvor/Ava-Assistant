// ava/db.ts
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

export const db = new Database(path.join(dataDir, "ava.db"));

// Run schema creation at startup
db.exec(`
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS users (
    account_number INTEGER PRIMARY KEY NOT NULL,
    display_name TEXT NOT NULL,
    one_time_pin_hash TEXT NOT NULL,
    security_type TEXT NOT NULL DEFAULT 'PIN',
    phone TEXT NULL,
    created_at TEXT NOT NULL,
    account_activated INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    account_number INTEGER NOT NULL,
    token TEXT NOT NULL,
    active TEXT NOT NULL DEFAULT 'TRUE',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT,
    revoked_at TEXT
  );

  CREATE TABLE IF NOT EXISTS conversation_memory (
    account_number TEXT PRIMARY KEY,
    last_message TEXT,
    last_intent TEXT,
    last_interaction TEXT,
    message_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS style_profile (
    account_number TEXT PRIMARY KEY,
    formality REAL DEFAULT 0.5,
    emoji_usage REAL DEFAULT 0.5,
    exclamation_level REAL DEFAULT 0.5,
    sentence_length REAL DEFAULT 0.5,
    playfulness REAL DEFAULT 0.5,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS low_confidence_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT NOT NULL,
    text TEXT NOT NULL,
    predicted_intent TEXT,
    confidence REAL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('unlabelled','labelled','skipped'))
  );

  CREATE TABLE IF NOT EXISTS conversation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_number TEXT NOT NULL,
    sender TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);
