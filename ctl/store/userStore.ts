// ava/store/userStore.ts

import { db } from "../db";

export interface ConversationMemory {
  account_number: number;
  lastMessage: string | null;
  lastIntent: string | null;
  lastInteraction: string | null;
  messageCount: number;
}

// -----------------------------
// USERS (creation is CLI-only)
// -----------------------------

const insertUserStmt = db.prepare(`
  INSERT INTO users (account_number, display_name, phone, created_at)
  VALUES (?, ?, ?, ?)
`);

const getUserStmt = db.prepare(`
  SELECT account_number, display_name, one_time_pin_hash, security_type, phone, created_at, account_activated
  FROM users
  WHERE account_number = ?
`);

/**
 * CLI-only.
 *
 * Create a user row if and only if:
 *  - account_number is a positive integer
 *  - the user does not already exist
 *
 * This should ONLY be called from:
 *  - CLI admin "create user" commands
 *  - future explicit registration flows
 *
 * It MUST NOT be called automatically for every message.
 */
export function createUserIfMissing(
  account_number: number,
  displayName: string,
  phone?: string
): void {
  if (!Number.isInteger(account_number) || account_number <= 0) {
    throw new Error(
      `createUserIfMissing: account_number must be a positive integer (> 0). Got ${account_number}`
    );
  }

  const existing = getUserStmt.get(account_number) as any | undefined;
  if (existing) {
    // User already exists -> no-op
    return;
  }

  const now = new Date().toISOString();
  insertUserStmt.run(account_number, displayName, phone ?? null, now);
}

// Optional helper if you need to read users later:
export function getUser(account_number: number): {
  account_number: number;
  display_name: string;
  one_time_pin_hash: string;
  security_type: string;
  phone: string;
  created_at: string;
  account_activated: string;
} | null {
  const row = getUserStmt.get(account_number) as | {
      account_number: number;
      display_name: string;
      one_time_pin_hash: string;
      security_type: string;
      phone: string;
      created_at: string;
      account_activated: string;
  } | undefined;

  if (!row) return null;

  return {
    account_number: row.account_number,
    display_name: row.display_name,
    one_time_pin_hash: row.one_time_pin_hash,
    security_type: row.security_type,
    phone: row.phone,
    created_at: row.created_at,
    account_activated: row.account_activated,
  };
}

// -----------------------------
// CONVERSATION MEMORY
// -----------------------------

const upsertConvMemoryStmt = db.prepare(`
  INSERT INTO conversation_memory (account_number, last_message, last_intent, last_interaction, message_count)
  VALUES (@account_number, @last_message, @last_intent, @last_interaction, @message_count)
  ON CONFLICT(account_number) DO UPDATE SET
    last_message = excluded.last_message,
    last_intent = excluded.last_intent,
    last_interaction = excluded.last_interaction,
    message_count = excluded.message_count
`);

const getConvMemoryStmt = db.prepare(`
  SELECT account_number, last_message, last_intent, last_interaction, message_count
  FROM conversation_memory
  WHERE account_number = ?
`);

export function getConversationMemory(account_number: number): ConversationMemory {
  const row = getConvMemoryStmt.get(account_number) as any;

  if (!row) {
    return {
      account_number,
      lastMessage: null,
      lastIntent: null,
      lastInteraction: null,
      messageCount: 0,
    };
  }

  return {
    account_number: row.account_number,
    lastMessage: row.last_message,
    lastIntent: row.last_intent,
    lastInteraction: row.last_interaction,
    messageCount: row.message_count ?? 0,
  };
}

export function updateConversationMemory(opts: {
  account_number: number;
  lastMessage: string;
  lastIntent: string | null;
}) {
  const current = getConversationMemory(opts.account_number);
  const now = new Date().toISOString();

  const updated: ConversationMemory = {
    account_number: opts.account_number,
    lastMessage: opts.lastMessage,
    lastIntent: opts.lastIntent,
    lastInteraction: now,
    messageCount: current.messageCount + 1,
  };

  upsertConvMemoryStmt.run({
    account_number: updated.account_number,
    last_message: updated.lastMessage,
    last_intent: updated.lastIntent,
    last_interaction: updated.lastInteraction,
    message_count: updated.messageCount,
  });

  return updated;
}
