// ava/respond/index.ts
import { UserContext } from "../types/context";
import { StyleProfile } from "../store/styleStore";
import { ConversationMemory } from "../store/userStore";

export type ResponseLabel =
  | "greet"
  | "clarify_low_conf"
  | "clarify_retry"
  | "clarify_dropped"
  | "clarify_no_match";

export interface ResponseContext {
  userId: string;
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
      return `Sorry, I didn’t quite get that. Please reply with "yes", "no", or "never mind".`;
    case "clarify_dropped":
      return "No problem, we can drop that one. What next?";
    case "clarify_no_match":
      return "Got it. Let’s start over — what would you like me to do?";
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

  const namePart = displayName ?? (casual ? "" : ctx.userId);
  const addressed = namePart ? ` ${namePart}` : "";

  let opener: string;

  if (casual) {
    opener = ["Hey", "Yo", "Hiya", "Heya"][Math.floor(Math.random() * 4)];
  } else {
    opener = tod === "morning" ? "Good morning" : tod === "evening" ? "Good evening" : "Hello";
  }

  let tail: string;

  if (memory.messageCount === 0) {
    tail = casual ? ", I’m Ava. What can I do for you?" : ", I’m Ava. How can I help today?";
  } else if (likesShort) {
    tail = ", what’s up?";
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
  const confPercent = ctx.intentConfidence != null ? (ctx.intentConfidence * 100).toFixed(1) : "??";

  return (
    `I’m not totally sure what you meant.\n` +
    `Did you want me to **${friendly}**?\n` +
    `(I’m about ${confPercent}% confident — reply with "yes", "no", or "never mind")`
  );
}

export function buildResponseContext(args: {
  user: UserContext;
  style: StyleProfile;
  memory: ConversationMemory;
  intentFriendlyName?: string;
  intentConfidence?: number;
}): ResponseContext {
  return {
    userId: args.user.userId,
    displayName: args.user.displayName,
    style: args.style,
    memory: args.memory,
    intentFriendlyName: args.intentFriendlyName,
    intentConfidence: args.intentConfidence,
  };
}
