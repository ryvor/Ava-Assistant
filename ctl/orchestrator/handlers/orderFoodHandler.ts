// ava/orchestrator/handlers/orderFoodHandler.ts
import { IntentHandler, HandlerContext } from "../IntentHandler";
import { OrchestratorResponse, UserContext } from "../../types/context";
import { NluResult } from "../../clients/rasaClient";
import { respond, buildResponseContext } from "../../respond";

export const orderFoodHandler: IntentHandler = {
  canHandle(intentName: string): boolean {
    return intentName === "order_food";
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
    const dishEntity = nlu.entities?.find((e: any) => e.entity === "dish");
    const dish = dishEntity?.value || "something tasty";
    const confirm = respond("confirm_generic", rctx);

    return {
      reply:
        `${confirm} You're asking about food - e.g. "${dish}". I don't talk to delivery apps yet, but that's the plan. 🍕`,
    };
  },
};
