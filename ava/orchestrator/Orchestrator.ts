import { ensureUser, updateConversationMemory, getConversationMemory, ConversationMemory } from "../store/userStore";
import { getStyleProfile, saveStyleProfile, StyleProfile } from "../store/styleStore";
import { analyseMessageStyle, mergeStyleProfile } from "../analysis/styleAnalyser";
import { parseText, NluResult } from "../nlu/rasaClient";
import { respond, buildResponseContext } from "../respond";
import { ResponseContext } from "../respond";
import { OrchestratorResponse, UserContext } from "../types/context";
import { intentHandlers } from "./handlers";
import { HandlerContext } from "./IntentHandler";
import { db } from "../db";

// ---- Active learning types (in-memory for now) ----

type SampleStatus = "unlabelled" | "labelled" | "skipped";

interface LowConfidenceSample {
  id: number;
  user_id: string;
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

// In-memory dialog states (still fine for now)
const dialogStates = new Map<string, DialogState>();

function getDialogState(userId: string): DialogState {
  return dialogStates.get(userId) ?? { mode: "idle" };
}

function setDialogState(userId: string, state: DialogState) {
  dialogStates.set(userId, state);
}

function clearDialogState(userId: string) {
  dialogStates.set(userId, { mode: "idle" });
}

// 🗄️ DB helpers
const insertLowConfSampleStmt = db.prepare(`
  INSERT INTO low_confidence_samples
    (user_id, text, predicted_intent, confidence, created_at, status)
  VALUES (?, ?, ?, ?, ?, 'unlabelled')
`);

const getLowConfSampleStmt = db.prepare<[{ id: number }], LowConfidenceSample | undefined>(`
  SELECT id, user_id, text, predicted_intent, confidence, created_at, status
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

// ---- Orchestrator ----

export class Orchestrator {
  private LOW_CONFIDENCE = 0.99;

  async handleMessage(text: string, user: UserContext): Promise<OrchestratorResponse> {
    const trimmed = text.trim();

    if (!trimmed) {
      return { reply: "Say something and I'll see what I can do 😄" };
    }

    ensureUser(user.userId, user.displayName);
    const existingMemory = getConversationMemory(user.userId);

    const styleBefore = getStyleProfile(user.userId);
    const styleSample = analyseMessageStyle(trimmed);
    const styleAfter = mergeStyleProfile(styleBefore, styleSample);
    saveStyleProfile(styleAfter);

    // 1) Check if user is mid-clarification flow
    const state = getDialogState(user.userId);
    if (state.mode === "awaiting_nlu_confirm" && state.sampleId) {
      return this.handleClarificationAnswer(trimmed, user, state);
    }

    // 2) Normal NLU flow
    let nlu: NluResult;
    try {
      nlu = await parseText(trimmed);
      console.log(`[${user.userId}] NLU result:`, JSON.stringify(nlu.raw, null, 2));
    } catch (err) {
      console.error("NLU error:", err);
      return { reply: "Sorry, I had trouble understanding that (NLU error)." };
    }

    const intent = nlu.intent;
    if (!intent) {
      // still update memory with null intent
      updateConversationMemory({
        userId: user.userId,
        lastMessage: nlu.text,
        lastIntent: null,
      });
      
      return { reply: "I'm not sure what you mean yet, but I'm still learning!" };
    }

    // 3) Low-confidence active learning hook
    if (intent.confidence < this.LOW_CONFIDENCE) {
      const now = new Date().toISOString();

      const result = insertLowConfSampleStmt.run(
        user.userId,
        nlu.text,
        intent.name,
        intent.confidence,
        now
      );

      const sampleId = Number(result.lastInsertRowid);

      setDialogState(user.userId, {
        mode: "awaiting_nlu_confirm",
        sampleId,
      });

      const friendly = getFriendlyIntentName(intent.name);
      const memoryAfter = updateConversationMemory({
        userId: user.userId,
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

    const updatedMemory = updateConversationMemory({
      userId: user.userId,
      lastMessage: nlu.text,
      lastIntent: intent.name,
    });

    // 4) Confident → route to handler
    return this.routeToHandler(nlu, user, styleAfter, updatedMemory);
  }

  private async routeToHandler(
    nlu: NluResult,
    user: UserContext,
    style: StyleProfile,
    memory: ConversationMemory
  ): Promise<OrchestratorResponse> {
    const intentName = nlu.intent?.name ?? "";
    const handlerCtx: HandlerContext = { style, memory };

    for (const handler of intentHandlers) {
      if (handler.canHandle(intentName)) {
        return handler.handle(nlu, user, handlerCtx);
      }
    }

    const fallback = intentHandlers[intentHandlers.length - 1];
    return fallback.handle(nlu, user, handlerCtx);
  }

  private async handleClarificationAnswer(
    text: string,
    user: UserContext,
    state: DialogState
  ): Promise<OrchestratorResponse> {
    const answer = text.toLowerCase();

    const sample = state.sampleId
      ? (getLowConfSampleStmt.get({ id: state.sampleId }) as LowConfidenceSample | undefined)
      : undefined;

    if (!sample) {
      clearDialogState(user.userId);
      return { reply: "Got it. Let's start over — what would you like me to do?" };
    }

    const isYes = ["yes", "y", "yeah", "yep", "correct", "right"].includes(answer);
    const isNo = ["no", "n", "nope", "wrong"].includes(answer);
    const isDismiss = ["never mind", "nvm", "forget it", "ignore", "leave it"].includes(answer);

    if (!isYes && !isNo && !isDismiss) {
      return {
        reply: `Sorry, I didn't quite get that. Please reply with "yes", "no", or "never mind".`,
      };
    }

    clearDialogState(user.userId);

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

      // get current style + memory for routing
      const style = getStyleProfile(user.userId);
      const memory = getConversationMemory(user.userId);

      const reply = await this.routeToHandler(forcedNlu, user, style, memory);
      return { reply: reply.reply };
    }


    if (isNo) {
      updateLowConfStatusStmt.run("skipped", sample.id);
      return {
        reply:
          "No worries, I won't treat that as that kind of request. Let's try again — what would you like me to do?",
      };
    }

    // Dismiss
    updateLowConfStatusStmt.run("skipped", sample.id);
    return {
      reply: "No problem, we can drop that one. What next?",
    };
  }
  
}
