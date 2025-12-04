// ava/orchestrator/handlers/fallbackHandler.ts
import { IntentHandler, HandlerContext } from "../IntentHandler";
import { OrchestratorResponse, UserContext } from "../../types/context";
import { NluResult } from "../../nlu/rasaClient";
import { respond, buildResponseContext } from "../../respond";

export const fallbackHandler: IntentHandler = {
  // Special: handles anything ("*")
  canHandle(): boolean {
    return true;
  },

  async handle(
    nlu: NluResult,
    user: UserContext,
    ctx: HandlerContext
  ): Promise<OrchestratorResponse> {
    const rctx = buildResponseContext({
      user,
      style: ctx.style,
      memory: ctx.memory,
    });


    const intentName = nlu.intent?.name ?? "unknown";
    const conf = nlu.intent?.confidence ?? 0;
    return {
      reply: `I understood this as "${intentName}" (confidence ${(conf * 100).toFixed(
        1
      )}%), but I don't have behaviour wired up yet.`,
    };
  },
};
