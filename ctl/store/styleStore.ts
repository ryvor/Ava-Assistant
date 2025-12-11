// ava/store/styleStore.ts
import { db } from "../db";

export interface StyleProfile {
  account_number: number;
  formality: number;
  emojiUsage: number;
  exclamationLevel: number;
  sentenceLength: number;
  playfulness: number;
}

const getStyleStmt = db.prepare(`
  SELECT account_number, formality, emoji_usage, exclamation_level, sentence_length, playfulness
  FROM style_profile
  WHERE account_number = ?
`);

const upsertStyleStmt = db.prepare(`
  INSERT INTO style_profile
    (account_number, formality, emoji_usage, exclamation_level, sentence_length, playfulness, updated_at)
  VALUES (@account_number, @formality, @emoji_usage, @exclamation_level, @sentence_length, @playfulness, @updated_at)
  ON CONFLICT(account_number) DO UPDATE SET
    formality = excluded.formality,
    emoji_usage = excluded.emoji_usage,
    exclamation_level = excluded.exclamation_level,
    sentence_length = excluded.sentence_length,
    playfulness = excluded.playfulness,
    updated_at = excluded.updated_at
`);

export function getStyleProfile(account_number: number): StyleProfile {
  const row = getStyleStmt.get(account_number) as any;

  if (!row) {
    return {
      account_number,
      formality: 0.5,
      emojiUsage: 0.3,
      exclamationLevel: 0.3,
      sentenceLength: 0.5,
      playfulness: 0.5,
    };
  }

  return {
    account_number: row.account_number,
    formality: row.formality,
    emojiUsage: row.emoji_usage,
    exclamationLevel: row.exclamation_level,
    sentenceLength: row.sentence_length,
    playfulness: row.playfulness,
  };
}

export function saveStyleProfile(profile: StyleProfile) {
  upsertStyleStmt.run({
    account_number: profile.account_number,
    formality: profile.formality,
    emoji_usage: profile.emojiUsage,
    exclamation_level: profile.exclamationLevel,
    sentence_length: profile.sentenceLength,
    playfulness: profile.playfulness,
    updated_at: new Date().toISOString(),
  });
}
