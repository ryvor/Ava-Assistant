// ava/orchestrator/handlers/bookTaxiHandler.ts
import { IntentHandler, HandlerContext } from "../IntentHandler";
import { OrchestratorResponse, UserContext } from "../../types/context";
import { NluResult } from "../../clients/rasaClient";
import { respond, buildResponseContext } from "../../respond";

export const bookTaxiHandler: IntentHandler = {
  canHandle(intentName: string): boolean {
    return intentName === "book_taxi";
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
    const confirm = respond("confirm_generic", rctx);

    return {
      reply:
        `${confirm} I've understood this as a taxi request: "${nlu.text}". Once I'm connected to a taxi service, I'll actually book it here. 🚕`,
    };
  },
};
