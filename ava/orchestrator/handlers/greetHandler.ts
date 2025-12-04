// ava/orchestrator/handlers/greetHandler.ts
import { IntentHandler, HandlerContext } from "../IntentHandler";
import { OrchestratorResponse, UserContext } from "../../types/context";
import { NluResult } from "../../nlu/rasaClient";
import { respond, buildResponseContext } from "../../respond";

export const greetHandler: IntentHandler = {
  canHandle(intentName: string): boolean {
    return intentName === "greet";
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

    const reply = respond("greet", rctx);

    return { reply };
  },
};