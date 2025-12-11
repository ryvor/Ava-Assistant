// ava/orchestrator/handlers/yesNoHandler.ts
import { IntentHandler, HandlerContext } from "../IntentHandler";
import { OrchestratorResponse, UserContext } from "../../types/context";
import { NluResult } from "../../nlu/rasaClient";

export const yesNoHandler: IntentHandler = {
  canHandle(intentName: string): boolean {
    return intentName === "affirm" || intentName === "deny";
  },

  async handle(
    nlu: NluResult,
    user: UserContext,
    _ctx: HandlerContext
  ): Promise<OrchestratorResponse> {
    if (nlu.intent?.name === "affirm") {
      return { reply: "Gotcha 👍" };
    } else {
      return { reply: "Alright, we’ll leave that then." };
    }
  },
};
