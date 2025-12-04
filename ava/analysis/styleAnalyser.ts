// ava/analysis/styleAnalyser.ts
import { StyleProfile } from "../store/styleStore";

export interface StyleSample {
  formality: number;       // 0–1
  emojiUsage: number;      // 0–1
  exclamationLevel: number;// 0–1
  sentenceLength: number;  // 0–1
  playfulness: number;     // 0–1
}

export function analyseMessageStyle(text: string): StyleSample {
  const emojiMatches = text.match(/[\p{Extended_Pictographic}]/gu) || [];
  const exclamations = (text.match(/!/g) || []).length;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const hasSlang = /lol|lmao|omg|mate|tbh|idk|hiya|yo/i.test(text);
  const hasFormal = /would you mind|please could you|if possible|would it be possible/i.test(text);

  let formality = 0.5;
  if (hasFormal && !hasSlang) formality = 0.8;
  else if (hasSlang && !hasFormal) formality = 0.2;

  const emojiUsage = Math.min(emojiMatches.length / 3, 1);
  const exclamationLevel = Math.min(exclamations / 3, 1);
  const sentenceLength = Math.min(wordCount / 25, 1);
  const playfulness = emojiUsage > 0.3 || exclamationLevel > 0.3 ? 0.7 : 0.4;

  return { formality, emojiUsage, exclamationLevel, sentenceLength, playfulness };
}

export function mergeStyleProfile(
  current: StyleProfile,
  sample: StyleSample,
  alpha = 0.15
): StyleProfile {
  function blend(oldVal: number, newVal: number) {
    return oldVal * (1 - alpha) + newVal * alpha;
  }

  return {
    ...current,
    formality: blend(current.formality, sample.formality),
    emojiUsage: blend(current.emojiUsage, sample.emojiUsage),
    exclamationLevel: blend(current.exclamationLevel, sample.exclamationLevel),
    sentenceLength: blend(current.sentenceLength, sample.sentenceLength),
    playfulness: blend(current.playfulness, sample.playfulness),
  };
}
