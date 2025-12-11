import { debugLog } from '../utils/debug.js';
import { fileURLToPath } from 'url';
import path from 'path';
import { getLlama, LlamaChatSession } from 'node-llama-cpp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1) Initialise llama + model + context + session ONCE
const llama = await getLlama();

const model = await llama.loadModel({
  modelPath: path.join(
    __dirname,
    './DeepSeek-R1-0528-Qwen3-8B-Q4_K_M.gguf' // adjust if your path/name differs
  ),
});

// 2) Ava's personality + reply helper
export async function getAvaReply(message: string, shortHistory: string): Promise<string> {
	const context = await model.createContext();
	const session = new LlamaChatSession({
	contextSequence: context.getSequence(),
	});
	const systemPrompt = `
You are Ava — a warm, witty, optimistic personal assistant that runs entirely on the user's local machine.

Personality:
- You are friendly, encouraging and slightly playful.
- You use light, clever humour, but never sarcasm or cruelty.
- You are emotionally aware and gently supportive.

Style rules:
- Keep replies concise by default (1-4 sho5rt paragraphs at most).
- Prefer shorter answers unless the user asks for more detail.

IMPORTANT:
- Do NOT output your internal reasoning or thinking process.
- Do NOT output chain-of-thought, step-by-step reasoning, or <think> tags.
- Assume everything is private and local.

Current history:
${shortHistory}

User message:
${message}

Instructions:
- Answer briefly and directly.
- Give only the final helpful answer.
- Do NOT explain your internal reasoning.
- Do NOT output chain-of-thought or <think> blocks.
`.trim();

	const fullPrompt = `${systemPrompt}`;

	const raw = await session.prompt(fullPrompt, {
		maxTokens: 256,
		temperature: 0.6,
		topP: 0.9,
	});

	return raw.trim();
}