// src/llm/textEngine.ts
import { performance } from "perf_hooks";
import { LlamaChatSession } from "node-llama-cpp";
import { getTextModel } from "../llm/coreModel.js";
import { getCtxTokens } from "../core/backendPolicy.js";

export async function warmTextModel() {
    const model =  await getTextModel();
    const context = await model.createContext({ contextSize: getCtxTokens() });
    const session = new LlamaChatSession({ contextSequence: context.getSequence() });

    // tiny warmup so first real request is faster
    await session.prompt("Say OK.", { maxTokens: 4, temperature: 0 });
}

type GenerationStats = {
    promptTokens: number;
    responseTokens: number;
    elapsedSec: number;
    tps: number | "n/a";
};

function estimateTokens(text: string): number {
    const clean = text.trim();
    if (!clean) return 0;
    // Rough heuristic: 4 chars per token for English-like text
    return Math.max(1, Math.round(clean.length / 4));
}

export async function generateText(fullPrompt: string): Promise<{ rawReply: string; stats: GenerationStats }> {
    const model = await getTextModel();

    // Stable approach: New context per call
    const context = await model.createContext({ contextSize: getCtxTokens() });
    const session = new LlamaChatSession({ contextSequence: context.getSequence() });

    const trimmedPrompt = fullPrompt.trim();
    const start = performance.now();
    const raw = await session.prompt(trimmedPrompt, {
        maxTokens: 512,
        temperature: 0.7,
        topP: 0.85,
    });
    const end = performance.now();
    const promptTokens = estimateTokens(trimmedPrompt);
    const responseTokens = estimateTokens(raw);
    const elapsedSec = (end - start) / 1000;
    const tps = responseTokens > 0 && elapsedSec > 0 ? Number((responseTokens / elapsedSec).toFixed(2)) : "n/a";

    return {
        rawReply: raw,
        stats: {
            promptTokens,
            responseTokens,
            elapsedSec,
            tps,
        },
    };
}
