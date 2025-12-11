// ava/orchestrator/handlers/documentQueryHandler.ts
import { IntentHandler, HandlerContext } from "../IntentHandler";
import { OrchestratorResponse, UserContext } from "../../types/context";
import { NluResult } from "../../clients/rasaClient";
import { respond, buildResponseContext } from "../../respond";

export const documentQuestionHandler: IntentHandler = {
  canHandle(intentName: string): boolean {
    return intentName === "document_question";
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
        `${confirm} You're asking about a document: "${nlu.text}". Once I can read files, I'll help with that. 📄`,
    };
  },
};
