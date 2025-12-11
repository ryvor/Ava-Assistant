// ava/orchestrator/IntentHandler.ts
import { NluResult } from "../clients/rasaClient";
import { OrchestratorResponse, UserContext } from "../types/context";
import { StyleProfile } from "../store/styleStore";
import { ConversationMemory } from "../store/userStore";
import { ChatAnalysis } from "../analysis/chatAnalyser";

export interface HandlerContext {
  style: StyleProfile;
  memory: ConversationMemory;
  chatAnalysis?: ChatAnalysis;
}

export interface IntentHandler {
  canHandle(intentName: string): boolean;
  handle(nlu: NluResult, user: UserContext, ctx: HandlerContext): Promise<OrchestratorResponse>;
  
}
