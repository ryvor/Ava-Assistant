// ava/orchestrator/Orchestrator.ts

import {
  updateConversationMemory,
  getConversationMemory,
  ConversationMemory,
} from "../store/userStore";
import {
  getStyleProfile,
  saveStyleProfile,
  StyleProfile,
} from "../store/styleStore";
import {
  analyseMessageStyle,
  mergeStyleProfile,
} from "../analysis/styleAnalyser";
import { analyseChatMessage, ChatAnalysis } from "../analysis/chatAnalyser";
import { OrchestratorResponse, UserContext } from "../types/context";
import { respond, buildResponseContext } from "../respond";
import { parseText, NluResult } from "../clients/rasaClient";
import { HandlerContext } from "./IntentHandler";
import { intentHandlers } from "./handlers";
import { db } from "../db";

// ---- Active learning types ----

type SampleStatus = "unlabelled" | "labelled" | "skipped";

interface LowConfidenceSample {
  id: number;
  account_number: string;
  text: string;
  predicted_intent: string | null;
  confidence: number | null;
  created_at: string;
  status: SampleStatus;
}

interface DialogState {
  mode: "idle" | "awaiting_nlu_confirm";
  sampleId?: number;
}

// In-memory dialog states
const dialogStates = new Map<number, DialogState>();

function getDialogState(account_number: number): DialogState {
  return dialogStates.get(account_number) ?? { mode: "idle" };
}

function setDialogState(account_number: number, state: DialogState) {
  dialogStates.set(account_number, state);
}

function clearDialogState(account_number: number) {
  dialogStates.set(account_number, { mode: "idle" });
}

// 🗄️ DB helpers
const insertConversationHistoryStmt = db.prepare(`
  INSERT INTO conversation_history (account_number, sender, message, created_at)
  VALUES (?, ?, ?, ?)
`);

const insertLowConfSampleStmt = db.prepare(`
  INSERT INTO low_confidence_samples
    (account_number, text, predicted_intent, confidence, created_at, status)
  VALUES (?, ?, ?, ?, ?, 'unlabelled')
`);

const getLowConfSampleStmt = db.prepare(`
  SELECT id, account_number, text, predicted_intent, confidence, created_at, status
  FROM low_confidence_samples
  WHERE id = ?
`);

const updateLowConfStatusStmt = db.prepare(`
  UPDATE low_confidence_samples
  SET status = ?
  WHERE id = ?
`);

function getFriendlyIntentName(intentName: string | null): string {
  if (!intentName) return "do something I know";
  switch (intentName) {
    case "greet":
      return "say hi";
    case "small_talk":
      return "just chat";
    case "order_food":
      return "order food";
    case "book_taxi":
      return "book a ride";
    case "document_question":
      return "help with a document";
    default:
      return intentName.replace(/_/g, " ");
  }
}

function isChatIntent(name: string): boolean {
  return [
    "greet",
    "goodbye",
    "small_talk",
    "mood_great",
    "mood_unhappy",
    "mood_negative",
    "bot_challenge",
  ].includes(name);
}

function isHighRiskIntent(name: string): boolean {
  return [
    "order_food",
    "book_taxi",
    "document_question",
    "create_user",
    "delete_user",
    "modify_user",
    "change_admin_password",
    // add any other “do stuff in the real world” intents here
  ].includes(name);
}


// ---- Orchestrator ----

export class Orchestrator {
  private LOW_CONFIDENCE = 0.7;

  async handleMessage(
    text: string,
    user: UserContext
  ): Promise<OrchestratorResponse> {
    const trimmed = text.trim();

    if (!trimmed) {
      return { reply: "Say something and I'll see what I can do 😄" };
    }
    // TODO: add message to conversation history log in DB

    // Load existing memory (even if we don't use it directly here, fine)
    getConversationMemory(user.account_number);

    // Style analysis
    const styleBefore = getStyleProfile(user.account_number);
    const styleSample = analyseMessageStyle(trimmed);
    const styleAfter = mergeStyleProfile(styleBefore, styleSample);
    saveStyleProfile(styleAfter);

    // 1) Clarification flow check
    const state = getDialogState(user.account_number);
    if (state.mode === "awaiting_nlu_confirm" && state.sampleId) {
      return this.handleClarificationAnswer(trimmed, user, state);
    }

    // 2) Normal NLU flow
    let nlu: NluResult;
    try {
      nlu = await parseText(trimmed);
      //console.log(`[${user.account_number}] NLU result:`, JSON.stringify(nlu.raw, null, 2));
    } catch (err) {
      console.error("NLU error:", err);
      return { reply: "Sorry, I had trouble understanding that (NLU error)." };
    }

    const intent = nlu.intent;

    if (!intent) {
      updateConversationMemory({
        account_number: user.account_number,
        lastMessage: nlu.text,
        lastIntent: null,
      });

      return {
        reply: "I'm not sure what you mean yet, but I'm still learning!",
      };
    }

    // 3) Low-confidence hook (for ALL intents, including chat, if you want)
    if (intent.confidence < this.LOW_CONFIDENCE && isHighRiskIntent(intent.name)) {
      // 3) Low-confidence hook (ONLY for high-risk intents)
      const now = new Date().toISOString();

      const result = insertLowConfSampleStmt.run(
        user.account_number,
        nlu.text,
        intent.name,
        intent.confidence,
        now
      );

      const sampleId = Number(result.lastInsertRowid);

      setDialogState(user.account_number, {
        mode: "awaiting_nlu_confirm",
        sampleId,
      });

      const friendly = getFriendlyIntentName(intent.name);
      const memoryAfter = updateConversationMemory({
        account_number: user.account_number,
        lastMessage: nlu.text,
        lastIntent: intent.name,
      });

      const ctx = buildResponseContext({
        user,
        style: styleAfter,
        memory: memoryAfter,
        intentFriendlyName: friendly,
        intentConfidence: intent.confidence,
      });

      return { reply: respond("clarify_low_conf", ctx) };
    }

    // 4) Confident intent → update memory
    const updatedMemory = updateConversationMemory({
      account_number: user.account_number,
      lastMessage: nlu.text,
      lastIntent: intent.name,
    });

    // 5) Optional chat analysis (for chat intents only)
    const chatAnalysis: ChatAnalysis | undefined = isChatIntent(intent.name)
      ? analyseChatMessage(nlu.text)
      : undefined;

    // 6) Route to handler
    return this.routeToHandler(nlu, user, styleAfter, updatedMemory, chatAnalysis);
  }

  private async routeToHandler(
    nlu: NluResult,
    user: UserContext,
    style: StyleProfile,
    memory: ConversationMemory,
    chatAnalysis?: ChatAnalysis
  ): Promise<OrchestratorResponse> {
    const intentName = nlu.intent?.name ?? "";
    const handlerCtx: HandlerContext = { style, memory, chatAnalysis };

    for (const handler of intentHandlers) {
      if (handler.canHandle(intentName)) {
        const raw = await handler.handle(nlu, user, handlerCtx);
        return this.normalizeHandlerResult(raw, intentName);
      }
    }

    const fallback = intentHandlers[intentHandlers.length - 1];
    const raw = await fallback.handle(nlu, user, handlerCtx);
    return this.normalizeHandlerResult(raw, intentName);
  }

  private normalizeHandlerResult(
    raw: OrchestratorResponse | undefined,
    intentName: string
  ): OrchestratorResponse {
    if (!raw || typeof raw.reply !== "string") {
      console.warn(
        `[Orchestrator] Handler for intent "${intentName}" returned invalid result:`,
        raw
      );
      return {
        reply:
          "I think I handled that, but I didn't generate a proper reply. I'll try to be clearer next time.",
      };
    }
    return raw;
  }

  private async handleClarificationAnswer(
    text: string,
    user: UserContext,
    state: DialogState
  ): Promise<OrchestratorResponse> {
    const answer = text.toLowerCase();

    const sample = state.sampleId
      ? (getLowConfSampleStmt.get(
          state.sampleId
        ) as LowConfidenceSample | undefined)
      : undefined;

    if (!sample) {
      clearDialogState(user.account_number);
      return {
        reply: "Got it. Let's start over - what would you like me to do?",
      };
    }

    const isYes = ["yes", "y", "yeah", "yep", "correct", "right"].includes(
      answer
    );
    const isNo = ["no", "n", "nope", "wrong"].includes(answer);
    const isDismiss = [
      "never mind",
      "nvm",
      "forget it",
      "ignore",
      "leave it",
    ].includes(answer);

    if (!isYes && !isNo && !isDismiss) {
      return {
        reply: `Sorry, I didn't quite get that. Please reply with "yes", "no", or "never mind".`,
      };
    }

    clearDialogState(user.account_number);

    if (isYes) {
      updateLowConfStatusStmt.run("labelled", sample.id);

      const forcedNlu: NluResult = {
        text: sample.text,
        intent: sample.predicted_intent
          ? { name: sample.predicted_intent, confidence: 1.0 }
          : null,
        entities: [],
        raw: { fromSampleId: sample.id },
      };

      const style = getStyleProfile(user.account_number);
      const memory = getConversationMemory(user.account_number);

      return await this.routeToHandler(forcedNlu, user, style, memory);
    }

    if (isNo) {
      updateLowConfStatusStmt.run("skipped", sample.id);
      return {
        reply:
          "No worries, I won't treat that as that kind of request. Let's try again - what would you like me to do?",
      };
    }

    // Dismiss
    updateLowConfStatusStmt.run("skipped", sample.id);
    return {
      reply: "No problem, we can drop that one. What next?",
    };
  }
}
