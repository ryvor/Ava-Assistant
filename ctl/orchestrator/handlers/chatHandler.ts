// ava/orchestrator/handlers/chatHandler.ts
import { IntentHandler, HandlerContext } from "../IntentHandler";
import { OrchestratorResponse, UserContext } from "../../types/context";
import { NluResult } from "../../clients/rasaClient";
import { ChatAnalysis } from "../../analysis/chatAnalyser";
import { generateGruSkeleton } from "../../clients/gruClient";


function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function fillTemplate(skeleton: string, slots: Record<string, string>): string {
  let text = skeleton;
  for (const [key, value] of Object.entries(slots)) {
    text = text.replace(new RegExp(`{{${key}}}`, "g"), value);
  }
  return text;
}

export function fallbackForLabel(label: string): string {
  switch (label) {
    case "greet":
      return "Hey {{name}}, how’s your {{time_of_day}} going? 😄";

    case "farewell":
      return "Bye {{name}}, talk to you later!";

    case "mood_positive_reply":
      return "Love that you’re feeling good, {{name}}! 🎉";

    case "mood_negative_reply":
      return "Sorry things are a bit rough right now, {{name}}. I’m here if you want to talk.";

    case "mood_strong_negative_reply":
      return "Sounds like you’re really frustrated, {{name}}. Want to vent a bit?";

    case "small_talk_generic":
      return "I’m here and listening, {{name}}. What’s on your mind?";

    case "small_talk_happy":
      return "That sounds great, {{name}} 😄 Tell me more!";

    case "small_talk_tired":
      return "You sound pretty wiped, {{name}}. Make sure you get some rest soon.";

    case "bot_challenge_reply":
      return "I’m a local assistant, not a human — but I’m here to help you as best I can. 🤖";

    default:
      return "Okay 🙂";
  }
}

export const chatHandler: IntentHandler = {
  canHandle(intentName: string): boolean {
    return (
      intentName === "greet" ||
      intentName === "goodbye" ||
      intentName === "small_talk" ||
      intentName === "mood_great" ||
      intentName === "mood_unhappy" ||
      intentName === "mood_negative" ||
      intentName === "bot_challenge"
    );
  },

  async handle(
    nlu: NluResult,
    user: UserContext,
    ctx: HandlerContext
  ): Promise<OrchestratorResponse> {
    const name = user.displayName ?? "there";
    const chat = ctx.chatAnalysis as ChatAnalysis | undefined;
    const mood = chat?.mood ?? "neutral";
    const topic = chat?.topic ?? "unknown";

    let label: string;

    switch (nlu.intent?.name) {
      case "greet":
        label = "greet";
        break;
      case "goodbye":
        label = "farewell";
        break;
      case "mood_great":
        label = "mood_positive_reply";
        break;
      case "mood_unhappy":
        label = "mood_negative_reply";
        break;
      case "mood_negative":
        label = "mood_strong_negative_reply";
        break;
      case "bot_challenge":
        label = "bot_challenge_reply";
        break;
      case "small_talk":
      default:
        if (mood === "tired" || mood === "stressed") {
          label = "small_talk_tired";
        } else if (mood === "happy") {
          label = "small_talk_happy";
        } else {
          label = "small_talk_generic";
        }
        break;
    }

    const skeleton = await generateGruSkeleton(label);
    const safeSkeleton =
      skeleton && skeleton.trim().length > 0
        ? skeleton
        : fallbackForLabel(label);

    const reply = fillTemplate(safeSkeleton, {
      name,
      topic,
      mood,
    });

    return { reply };
  },
};

