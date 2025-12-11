// ava/analysis/chatAnalyser.ts
export type Mood =
  | "happy"
  | "sad"
  | "tired"
  | "stressed"
  | "angry"
  | "neutral";

export type Topic =
  | "work"
  | "food"
  | "sleep"
  | "life"
  | "tech"
  | "unknown";

export interface ChatAnalysis {
  mood: Mood;
  topic: Topic;
}

export function analyseChatMessage(text: string): ChatAnalysis {
  const lower = text.toLowerCase();

  // --- Mood detection (very simple for now) ---
  if (/(tired|exhausted|knackered|drained|worn out)/.test(lower)) {
    return { mood: "tired", topic: detectTopic(lower) };
  }

  if (/(sad|down|depressed|low)/.test(lower)) {
    return { mood: "sad", topic: detectTopic(lower) };
  }

  if (/(angry|annoyed|pissed off|furious|mad)/.test(lower)) {
    return { mood: "angry", topic: detectTopic(lower) };
  }

  if (/(stressed|overwhelmed|anxious|on edge)/.test(lower)) {
    return { mood: "stressed", topic: detectTopic(lower) };
  }

  if (/(happy|great|awesome|amazing|buzzing|fantastic|good day)/.test(lower)) {
    return { mood: "happy", topic: detectTopic(lower) };
  }

  return { mood: "neutral", topic: detectTopic(lower) };
}

function detectTopic(lower: string): Topic {
  if (/(work|job|shift|office|boss|coworker|colleague)/.test(lower)) {
    return "work";
  }
  if (/(pizza|food|takeaway|dinner|lunch|breakfast|eat|hungry)/.test(lower)) {
    return "food";
  }
  if (/(sleep|bed|nap|tired|insomnia)/.test(lower)) {
    return "sleep";
  }
  if (/(life|day|week|everything|stuff|lot going on)/.test(lower)) {
    return "life";
  }
  if (/(computer|code|coding|programming|game|phone|tech)/.test(lower)) {
    return "tech";
  }
  return "unknown";
}
