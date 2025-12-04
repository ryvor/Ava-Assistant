// ava/orchestrator/handlers/bookTaxiHandler.ts
import { IntentHandler, HandlerContext } from "../IntentHandler";
import { OrchestratorResponse, UserContext } from "../../types/context";
import { NluResult } from "../../nlu/rasaClient";
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

    const text = nlu.text;
    return {
      reply: `You want a ride. In future I'll actually call Taxi APIs here.\nFor now I just know: "${text}". 🚗`,
    };
  },
};
