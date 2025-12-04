// ava/store/userStore.ts
import { db } from "../db";

export interface ConversationMemory {
  userId: string;
  lastMessage: string | null;
  lastIntent: string | null;
  lastInteraction: string | null;
  messageCount: number;
}

const insertUserStmt = db.prepare(`
  INSERT OR IGNORE INTO users (id, display_name, phone, created_at)
  VALUES (?, ?, ?, ?)
`);

const upsertConvMemoryStmt = db.prepare(`
  INSERT INTO conversation_memory (user_id, last_message, last_intent, last_interaction, message_count)
  VALUES (@user_id, @last_message, @last_intent, @last_interaction, @message_count)
  ON CONFLICT(user_id) DO UPDATE SET
    last_message = excluded.last_message,
    last_intent = excluded.last_intent,
    last_interaction = excluded.last_interaction,
    message_count = excluded.message_count
`);

const getConvMemoryStmt = db.prepare(`
  SELECT user_id, last_message, last_intent, last_interaction, message_count
  FROM conversation_memory
  WHERE user_id = ?
`);

export function ensureUser(userId: string, displayName?: string, phone?: string) {
  const now = new Date().toISOString();
  insertUserStmt.run(userId, displayName ?? null, phone ?? null, now);
}

export function getConversationMemory(userId: string): ConversationMemory {
  const row = getConvMemoryStmt.get(userId) as any;

  if (!row) {
    return {
      userId,
      lastMessage: null,
      lastIntent: null,
      lastInteraction: null,
      messageCount: 0,
    };
  }

  return {
    userId: row.user_id,
    lastMessage: row.last_message,
    lastIntent: row.last_intent,
    lastInteraction: row.last_interaction,
    messageCount: row.message_count ?? 0,
  };
}

export function updateConversationMemory(opts: {
  userId: string;
  lastMessage: string;
  lastIntent: string | null;
}) {
  const current = getConversationMemory(opts.userId);
  const now = new Date().toISOString();

  const updated: ConversationMemory = {
    userId: opts.userId,
    lastMessage: opts.lastMessage,
    lastIntent: opts.lastIntent,
    lastInteraction: now,
    messageCount: current.messageCount + 1,
  };

  upsertConvMemoryStmt.run({
    user_id: updated.userId,
    last_message: updated.lastMessage,
    last_intent: updated.lastIntent,
    last_interaction: updated.lastInteraction,
    message_count: updated.messageCount,
  });

  return updated;
}
