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
    id TEXT PRIMARY KEY,
    display_name TEXT,
    phone TEXT,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS conversation_memory (
    user_id TEXT PRIMARY KEY,
    last_message TEXT,
    last_intent TEXT,
    last_interaction TEXT,
    message_count INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS style_profile (
    user_id TEXT PRIMARY KEY,
    formality REAL DEFAULT 0.5,
    emoji_usage REAL DEFAULT 0.5,
    exclamation_level REAL DEFAULT 0.5,
    sentence_length REAL DEFAULT 0.5,
    playfulness REAL DEFAULT 0.5,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS low_confidence_samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    predicted_intent TEXT,
    confidence REAL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('unlabelled','labelled','skipped'))
  );
`);
