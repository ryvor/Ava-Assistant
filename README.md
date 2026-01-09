# Ava Assistant

Ava is a local-first, friendly AI assistant. She runs on your machine, uses a LLaMA-compatible model via `node-llama-cpp`, and serves a single-page chat UI in your browser. There is no cloud dependency for inference-everything stays local.

## Features

- Warm, concise personality tuned for short, helpful replies.
- Decision engine (experimental) that can classify intents (chat/order food/book taxi) from conversation history.
- Modern web UI with animated chat bubbles, theme toggle, and sidebar layout.
- Single Express server that serves the UI and exposes `/api/chat`.
- Configurable via `.env` for ports and model settings.

## Requirements

- Node.js 18+
- A compatible GGUF model file (defaults live under `src/model`).
- macOS/Linux recommended (Windows works but needs the build toolchain for `node-llama-cpp`).

## Quick Start

1. Install dependencies:

   ``` bash
   npm install
   ```

2. Configure env (optional):

   ```bash
   cp .env.example .env
   # set WEB_PORT or PORT as needed
   ```

3. Run in dev (TS with watch):

   ```bash
   npm run dev
   ```

4. Build and run:

   ```bash
   npm run build
   npm start
   ```

5. Open the UI: `http://localhost:4173` (or your `WEB_PORT` / `PORT`).

## Voice Replies (Supertonic 2)

- Requires Python 3.9+ with `pip install supertonic` (first use downloads the model ~260MB).
- Enable in `.env` (see `.env.example`) with `SUPERTONIC_ENABLED=true`; optional knobs: `SUPERTONIC_VOICE`, `SUPERTONIC_STEPS`, `SUPERTONIC_SPEED`, `SUPERTONIC_PYTHON`.
- Audio is generated on-demand and cached under `data/tts-cache/`.
- In the chat UI, toggle the speaker icon to auto-play Ava replies; each Ava bubble also has a replay button.

## API

- `POST /api/chat`
  - Body: `{ "message": "Hello Ava" }`
  - Response: `{ "reply": "Hi! How can I help today?" }`

(Decision engine output is experimental; see `src/api/chatRoutes.ts` and `src/model/decisionEngine.ts`.)

## Configuration

- `.env`:
  - `WEB_PORT` or `PORT`: server port.
- Model paths:
  - `src/model/llama.ts` and `src/model/decisionEngine.ts` reference local GGUF files. Update these paths if you swap models or move files.
- Static assets:
  - `src/web/` contains the UI assets served by Express.

## File Map (key parts)

- `src/index.ts` - Express server entry.
- `src/api/chatRoutes.ts` - Chat endpoint.
- `src/model/llama.ts` - Chat generation (personality + reply).
- `src/model/decisionEngine.ts` - Intent classifier (experimental).
- `src/web/` - Front-end (HTML/CSS/JS, icons, manifest).

## Model Source

- Default GGUF: [`chenly124/DeepSeek-R1-0528-Qwen3-8B-Q4_K_M-GGUF`](https://huggingface.co/chenly124/DeepSeek-R1-0528-Qwen3-8B-Q4_K_M-GGUF).

## Troubleshooting

- Port not picked from `.env`: ensure `dotenv` is loaded and `.env` is in the project root; set `WEB_PORT` or `PORT`.
- No reply from `/api/chat`: confirm the model file path exists where the server runs; ensure the handler returns `{ reply }` (not `{ raw }`).
- Icons missing: make sure Phosphor assets are served (see static route in `src/index.ts`).

## Safety & Privacy

- Inference is local; no user messages leave your machine unless you explicitly point the model client to a remote endpoint.
- Logs stay local; clear them if needed.
