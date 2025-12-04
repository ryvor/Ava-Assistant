// ava/orchestrator/IntentHandler.ts
import { NluResult } from "../nlu/rasaClient";
import { OrchestratorResponse, UserContext } from "../types/context";
import { StyleProfile } from "../store/styleStore";
import { ConversationMemory } from "../store/userStore";

export interface HandlerContext {
  style: StyleProfile;
  memory: ConversationMemory;
}

export interface IntentHandler {
  canHandle(intentName: string): boolean;
  handle(nlu: NluResult, user: UserContext, ctx: HandlerContext): Promise<OrchestratorResponse>;
}
