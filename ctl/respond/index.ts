// ava/respond/index.ts

import { UserContext } from "../types/context";
import { StyleProfile } from "../store/styleStore";
import { ConversationMemory } from "../store/userStore";

export type ResponseLabel =
  | "greet"
  | "clarify_low_conf"
  | "clarify_retry"
  | "clarify_dropped"
  | "clarify_no_match"
  | "confirm_generic"
  | "confirm_task_done"
  | "confirm_saved";

export interface ResponseContext {
  account_number: number;
  displayName?: string;
  style: StyleProfile;
  memory: ConversationMemory;
  // extras
  intentFriendlyName?: string;
  intentConfidence?: number;
}

function timeOfDay(): "morning" | "afternoon" | "evening" | "late" {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 22) return "evening";
  return "late";
}

export function respond(label: ResponseLabel, ctx: ResponseContext): string {
  switch (label) {
    case "greet":
      return respondGreeting(ctx);

    case "clarify_low_conf":
      return respondClarifyLowConf(ctx);

    case "clarify_retry":
      return `Sorry, I didn't quite get that. Please reply with "yes", "no", or "never mind".`;

    case "clarify_dropped":
      return "No problem, we can drop that one. What next?";

    case "clarify_no_match":
      return "Got it. Let's start over - what would you like me to do?";

    // 🔹 NEW confirmation responses
    case "confirm_generic":
    case "confirm_task_done":
    case "confirm_saved":
      return respondConfirmation(label, ctx);

    default:
      return "Okay 🙂";
  }
}

function respondGreeting(ctx: ResponseContext): string {
  const tod = timeOfDay();
  const { style, displayName, memory } = ctx;

  const casual = style.formality < 0.4;
  const emojiFriendly = style.emojiUsage > 0.3;
  const likesShort = style.sentenceLength < 0.4;

  const namePart = displayName ?? (casual ? "" : ctx.account_number);
  const addressed = namePart ? ` ${namePart}` : "";

  let opener: string;

  if (casual) {
    const options = ["Hey", "Yo", "Hiya", "Heya"];
    opener = options[Math.floor(Math.random() * options.length)];
  } else {
    opener =
      tod === "morning"
        ? "Good morning"
        : tod === "evening"
        ? "Good evening"
        : "Hello";
  }

  let tail: string;

  if (memory.messageCount === 0) {
    tail = casual
      ? ", I'm Ava. What can I do for you?"
      : ", I'm Ava. How can I help today?";
  } else if (likesShort) {
    tail = ", what's up?";
  } else {
    tail = ", what can I do for you?";
  }

  if (emojiFriendly) {
    tail += " 😄";
  }

  return `${opener}${addressed}${tail}`;
}

function respondClarifyLowConf(ctx: ResponseContext): string {
  const friendly = ctx.intentFriendlyName ?? "do something";
  const confPercent =
    ctx.intentConfidence != null
      ? (ctx.intentConfidence * 100).toFixed(1)
      : "??";

  return (
    `I'm not totally sure what you meant.\n` +
    `Did you want me to **${friendly}**?\n` +
    `(I'm about ${confPercent}% confident - reply with "yes", "no", or "never mind")`
  );
}

// 🔹 NEW: confirmation builder

function respondConfirmation(
  label: "confirm_generic" | "confirm_task_done" | "confirm_saved",
  ctx: ResponseContext
): string {
  const { style } = ctx;

  // Map internal labels -> .lang keys
  const langKey =
    label === "confirm_generic"
      ? "confirm.generic"
      : label === "confirm_task_done"
      ? "confirm.task_done"
      : "confirm.saved";

  const base = getRandomLangOption(langKey) ?? "Okay";

  const casual = style.formality < 0.4;
  const veryFormal = style.formality > 0.7;
  const emojiFriendly = style.emojiUsage > 0.3;
  const likesBang =
    // if you don't have exclamationUsage in StyleProfile yet, either add it or change this
    (style as any).exclamationUsage &&
    (style as any).exclamationUsage > 0.2;

  // 1) Punctuation
  let withPunc = base;
  if (likesBang && !veryFormal && !/[!?]$/.test(base)) {
    withPunc += "!";
  } else if (!/[.!?]$/.test(base)) {
    withPunc += ".";
  }

  // 2) Emoji (optional)
  if (emojiFriendly) {
    let emojiPool: string[];
    if (label === "confirm_task_done") emojiPool = ["✅", "👍", "👌", "🙌"];
    else if (label === "confirm_saved") emojiPool = ["💾", "📝", "✅"];
    else emojiPool = ["🙂", "👌", "👍"];

    const emoji = emojiPool[Math.floor(Math.random() * emojiPool.length)];
    withPunc += " " + emoji;
  }

  return withPunc;
}

export function buildResponseContext(args: {
  user: UserContext;
  style: StyleProfile;
  memory: ConversationMemory;
  intentFriendlyName?: string;
  intentConfidence?: number;
}): ResponseContext {
  return {
    account_number: args.user.account_number,
    displayName: args.user.displayName,
    style: args.style,
    memory: args.memory,
    intentFriendlyName: args.intentFriendlyName,
    intentConfidence: args.intentConfidence,
  };
}
