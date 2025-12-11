// ava/orchestrator/handlers/greetHandler.ts
import { IntentHandler, HandlerContext } from "../IntentHandler";
import { OrchestratorResponse, UserContext } from "../../types/context";
import {  } from "../../store/userStore";
import { NluResult } from "../../clients/rasaClient";
import { generateGruSkeleton } from "../../clients/gruClient";

// Optional helper for time of day
function getTimeOfDay(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export const greetHandler: IntentHandler = {
  canHandle(intentName: string): boolean {
    return intentName === "greet";
  },

  async handle(
    _nlu: NluResult,
    user: UserContext,
    _ctx: HandlerContext
  ) {
    const timeOfDay = getTimeOfDay();
    const name = user.displayName;
    const skeleton = await generateGruSkeleton("greet");
    const safeSkeleton = (skeleton && skeleton.trim().length > 0 ? skeleton : "Hello {{name}}, how can I help today?")
      .replace(/{{name}}/g, name)
      .replace(/{{time_of_day}}/g, timeOfDay);

      console.log("User: ", user);

      return {
      reply: safeSkeleton,
    };
  },
};
