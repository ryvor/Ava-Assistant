// src/model/decisionEngine.ts
import { generateText } from '../llm/textEngine.js';
import { debugLog } from '../utils/debug.js';
import { getTools } from "../tools/registry.js";
import { buildToolsPrompt } from "../tools/promptTools.js";

const toolsPrompt = buildToolsPrompt(getTools());

// Strip out <think>...</think> sections from model output
function stripThink(text: string) {
    return text
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<\/think>/gi, "")
        .trim();
}

type Mode = "CHAT" | "TOOL";
type ToolName = "NONE" | "ORDER_FOOD" | "BOOK_TAXI";

function normalizeModelReply(raw: any, message: string) {
    const allowedModes: Mode[] = ["CHAT", "TOOL"];
    const allowedTools: ToolName[] = ["NONE", "ORDER_FOOD", "BOOK_TAXI"];

    const cleaned: any = raw && typeof raw === "object" ? { ...raw } : {};
    if (typeof cleaned.mode === "string" && cleaned.mode.includes("|")) {
        cleaned.mode = cleaned.mode.split("|").find((m: string) => allowedModes.includes(m as Mode)) || "CHAT";
    }
    if (!allowedModes.includes(cleaned.mode)) {
        cleaned.mode = allowedTools.includes(cleaned.tool) && cleaned.tool !== "NONE" ? "TOOL" : "CHAT";
    }
    if (typeof cleaned.tool === "string" && cleaned.tool.includes("|")) {
        cleaned.tool = cleaned.tool.split("|").find((t: string) => allowedTools.includes(t as ToolName)) || "NONE";
    }
    if (!allowedTools.includes(cleaned.tool)) {
        cleaned.tool = "NONE";
    }
    if (cleaned.tool !== "NONE") {
        cleaned.mode = "TOOL";
    }
    if (!cleaned.parameters || typeof cleaned.parameters !== "object") {
        cleaned.parameters = {};
    }
    if (typeof cleaned.reply !== "string") {
        cleaned.reply = "";
    }
    if (typeof cleaned.reason !== "string") {
        cleaned.reason = "";
    }

    if (cleaned.tool === "ORDER_FOOD") {
        const items = (cleaned.parameters as any).items;
        if (typeof items === "string") {
            cleaned.parameters.items = [items];
        }
    }
    if (cleaned.tool === "BOOK_TAXI") {
        const passengers = (cleaned.parameters as any).passengers;
        if (typeof passengers === "string" && passengers.trim()) {
            const parsed = Number(passengers);
            cleaned.parameters.passengers = Number.isFinite(parsed) ? parsed : passengers;
        }
    }

    const params = cleaned.parameters || {};
    const hasValue = (value: any) => {
        if (Array.isArray(value)) return value.length > 0;
        if (value === null || value === undefined) return false;
        return String(value).trim().length > 0;
    };
    const hasTaxiParams = ["pickup", "destination", "time", "passengers"].some((k) => hasValue(params[k]));
    const hasFoodParams = ["cuisine", "items", "address"].some((k) => hasValue(params[k]));
    const reasonText = typeof cleaned.reason === "string" ? cleaned.reason.toLowerCase() : "";

    if (cleaned.tool === "NONE" && cleaned.mode === "CHAT" && (hasTaxiParams || hasFoodParams)) {
        cleaned.tool = hasTaxiParams ? "BOOK_TAXI" : "ORDER_FOOD";
        cleaned.mode = "TOOL";
    } else if (cleaned.tool === "NONE" && /book_taxi|order_food/.test(reasonText)) {
        cleaned.tool = reasonText.includes("book_taxi") ? "BOOK_TAXI" : "ORDER_FOOD";
        cleaned.mode = "TOOL";
    } else if (cleaned.tool === "NONE" && cleaned.mode === "CHAT") {
        const msg = (message || "").toLowerCase();
        if (/(taxi|cab|ride|uber|lyft|pickup|airport)/.test(msg)) {
            cleaned.tool = "BOOK_TAXI";
            cleaned.mode = "TOOL";
        } else if (/(order|food|pizza|burger|takeaway|delivery)/.test(msg)) {
            cleaned.tool = "ORDER_FOOD";
            cleaned.mode = "TOOL";
        }
    }

    return cleaned;
}

export async function getAvaReply(message: string, shortHistory: string): Promise<{
    json: object;
    promptTokens: number;
    responseTokens: number;
    elapsedSec: number;
    tps: number | "n/a";
}> {
    debugLog("debug", "Generating Ava reply...");
    let prompt = `
You are Ava, a warm, capable, and quietly confident personal assistant.

You speak like a friendly, knowledgeable companion:
- Supportive and approachable
- Clear and practical
- Lightly witty when it fits, never sarcastic or overbearing

Your style:
- Be concise by default
- Explain things when it helps
- Focus on being genuinely useful
- Ask one follow-up question only when it adds value

Your behaviour:
- Acknowledge frustration calmly if the user seems stuck
- Stay grounded and reassuring
- If you don't know something, say so plainly and suggest a next step

Rules:
- Do not mention being an AI model
- Do not explain your internal reasoning
- Do not output <think> tags or hidden thoughts
- Keep responses natural and human

Conversation history:
${shortHistory}

Current user message:
${message}

Tools available:
all parameters are required unless marked optional.
${toolsPrompt}

You must reply ONLY with valid JSON. No extra text. No code fences.

Allowed values:
- mode must be exactly "CHAT" or "TOOL"
- tool must be exactly "NONE", "ORDER_FOOD", or "BOOK_TAXI"

Schema (must match exactly, do not output placeholder values like "CHAT|TOOL"):
{
  "mode": "CHAT",
  "tool": "NONE",
  "reply": "string|null",
  "reason": "string",
  "parameters": {}
}

Rules:
- If mode is "CHAT": tool must be "NONE" and reply must be a non-empty string.
- If mode is "TOOL": tool must be one of the tool names and reply must have a valid response about what you have done.
- mode must NOT be a combination of modes. Only one mode is allowed at any time.
- parameters must be an object. Include best-effort extracted fields, otherwise leave empty.

Return JSON only. Respond as Ava.
`;

    debugLog("debug", "Prompt constructed, sending to text generator.");
    debugLog("trace", `Prompt: ${prompt}`);

    const { rawReply, stats } = await generateText(prompt);
    debugLog("debug", "Ava reply generated.");
    debugLog("trace", `reply: ${rawReply}`);

    // Robust parsing: try direct parse, otherwise extract JSON-looking substring
    const cleaned = stripThink(rawReply);
    let reply: any;
    try {
        reply = JSON.parse(cleaned);
    } catch (err) {
        debugLog("warn", "Direct JSON parse failed, attempting to extract JSON substring.");
        const match = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
            try {
                reply = JSON.parse(match[0]);
            } catch (err2) {
                debugLog("error", `Failed to parse extracted JSON: ${err2}`);
                throw new Error(`Invalid JSON from model (extracted): ${err2}`);
            }
        } else {
            debugLog("error", `No JSON object found in model output. Raw output: ${cleaned.slice(0, 1000)}`);
            throw new Error("Invalid JSON from model");
        }
    }

    const normalized = normalizeModelReply(reply, message);
    debugLog("debug", `Normalized reply: ${JSON.stringify(normalized)}`);

    // Basic validation
    if (!normalized || typeof normalized !== "object" || typeof (normalized as any).reply !== "string") {
        debugLog("error", `Model JSON missing or invalid 'reply' field: ${JSON.stringify(normalized).slice(0, 1000)}`);
        throw new Error("Model returned invalid JSON (missing 'reply' string)");
    }

    return {
        json: normalized,
        promptTokens: stats.promptTokens,
        responseTokens: stats.responseTokens,
        elapsedSec: stats.elapsedSec,
        tps: stats.tps,
    };
}
