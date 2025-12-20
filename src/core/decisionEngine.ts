// src/model/decisionEngine.ts
import { generateText } from '../llm/textEngine.js';
import { debugLog } from '../utils/debug.js';
import { getTools } from "../tools/registry.js";
import { buildToolsPrompt } from "../tools/promptTools.js";

const toolsList = getTools();
const toolsPrompt = buildToolsPrompt(toolsList);

// Strip out <think>...</think> sections from model output
function stripThink(text: string) {
    return text
        .replace(/<think>[\s\S]*?<\/think>/gi, "")
        .replace(/<\/think>/gi, "")
        .trim();
}

type Mode = "CHAT" | "TOOL";
type ToolName = "NONE" | (typeof toolsList)[number]["name"];

function normalizeModelReply(raw: any, message: string) {
    const allowedModes: Mode[] = ["CHAT", "TOOL"];
    const allowedTools: ToolName[] = ["NONE", ...toolsList.map((t) => t.name as ToolName)];

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
    } else if (!allowedModes.includes(cleaned.mode)) {
        cleaned.mode = "CHAT";
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

IMPORTANT:
- Never claim that a real-world or persistent action has already happened.
- Do not say things like "I have created", "I have saved", "I have booked".
- Only describe intent or ask for the next required detail.

Conversation history:
${shortHistory}

Current user message:
${message}

Tools available:
all parameters are required unless marked optional.
${toolsPrompt}

You must reply ONLY with valid JSON. No extra text. No code fences. If the user has already provided required details, do NOT repeat that you can help—act with the tool when possible. Provide concrete parameter values from the latest user message and conversation; avoid placeholders. Ask only for the single most important missing detail.

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
 - If mode is "TOOL":
  - Do NOT claim the action has been completed.
  - reply must either:
   a) ask for the single most important missing detail, or
   b) briefly acknowledge the request and say what will happen next.

- mode must NOT be a combination of modes. Only one mode is allowed at any time.
- parameters must be an object. Include best-effort extracted fields, otherwise leave empty.

Return JSON only. Respond as Ava.
`;

    debugLog("debug", "Prompt constructed, sending to text generator.");
    debugLog("trace", `Prompt: ${prompt}`);

    const { rawReply, stats } = await generateText(prompt);
    debugLog("debug", "Ava reply generated.");
    debugLog("debug", `reply: ${rawReply}`);

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
    debugLog("trace", `Normalized reply: ${JSON.stringify(normalized)}`);

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

