// ava/store/styleStore.ts
import { db } from "../db";

export interface StyleProfile {
  userId: string;
  formality: number;
  emojiUsage: number;
  exclamationLevel: number;
  sentenceLength: number;
  playfulness: number;
}

const getStyleStmt = db.prepare(`
  SELECT user_id, formality, emoji_usage, exclamation_level, sentence_length, playfulness
  FROM style_profile
  WHERE user_id = ?
`);

const upsertStyleStmt = db.prepare(`
  INSERT INTO style_profile
    (user_id, formality, emoji_usage, exclamation_level, sentence_length, playfulness, updated_at)
  VALUES (@user_id, @formality, @emoji_usage, @exclamation_level, @sentence_length, @playfulness, @updated_at)
  ON CONFLICT(user_id) DO UPDATE SET
    formality = excluded.formality,
    emoji_usage = excluded.emoji_usage,
    exclamation_level = excluded.exclamation_level,
    sentence_length = excluded.sentence_length,
    playfulness = excluded.playfulness,
    updated_at = excluded.updated_at
`);

export function getStyleProfile(userId: string): StyleProfile {
  const row = getStyleStmt.get(userId) as any;

  if (!row) {
    return {
      userId,
      formality: 0.5,
      emojiUsage: 0.3,
      exclamationLevel: 0.3,
      sentenceLength: 0.5,
      playfulness: 0.5,
    };
  }

  return {
    userId: row.user_id,
    formality: row.formality,
    emojiUsage: row.emoji_usage,
    exclamationLevel: row.exclamation_level,
    sentenceLength: row.sentence_length,
    playfulness: row.playfulness,
  };
}

export function saveStyleProfile(profile: StyleProfile) {
  upsertStyleStmt.run({
    user_id: profile.userId,
    formality: profile.formality,
    emoji_usage: profile.emojiUsage,
    exclamation_level: profile.exclamationLevel,
    sentence_length: profile.sentenceLength,
    playfulness: profile.playfulness,
    updated_at: new Date().toISOString(),
  });
}
