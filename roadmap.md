# Ava Assistant Roadmap

This document tracks planned work for Ava: a local-first assistant that runs entirely on the user’s machine (LLM inference + web UI), with multi-user sessions, chat history, and user notes.

## Guiding Principles

- Local-first: inference and data stay on-device by default.
- Fast by default: mid-range hardware should feel snappy.
- Predictable UX: consistent UI structure across pages and clear loading/error states.
- Extensible core: “tools” should be easy to add and safe to run.

## Current Status (Baseline)

- Web UI: `/login`, `/options`, `/notes`, main chat UI (served by Express).
- Auth: session-token based login (no PIN stored on device).
- Storage: SQLite via `better-sqlite3` (users, sessions, chat history, user notes).
- LLM: `node-llama-cpp` with model selection and backend policy via `.env`.
- Tools: decision engine produces JSON with `mode` and `tool` hints.
- Reliability: chat queueing per-user with cancellation/superseding behavior.

## Milestones

### v0.1 — Stability & Polish

- [ ] Ensure chat generation always returns valid JSON (normalize and validate).
- [ ] Persist tool metadata alongside chat rows (mode/tool/reason/params) consistently.
- [ ] Make “pending reply after restart” deterministic (server resumes unfinished user message on next poll).
- [ ] Harden message queue behavior:
  - [ ] Cancel/supersede messages per user without confusing UI states.
  - [ ] Return explicit cancellation response codes the UI can interpret.
- [ ] UI: show consistent “working” status across reloads, reconnects, and server restarts.

### v0.2 — Tool Execution (First Real Actions)

- [ ] Implement actual tool handlers:
  - [ ] `ORDER_FOOD` (start with a “planner” + confirmation flow; later: integrations).
  - [ ] `BOOK_TAXI` (planner + confirmation; later: provider integration).
  - [ ] `FIND_ITEM` ()
  - [ ] `` ()
- [ ] Add a server-side tool runner interface:
  - [ ] Validate tool params with Zod before execution.
  - [ ] Log tool calls + results (and errors) in DB.
  - [ ] Return structured UI events so the client can render “actions taken”.
- [ ] Add a “confirm before action” safety gate for tools that could place orders.

### v0.3 — Multi-User & Device Management

- [ ] Sessions table UX:
  - [ ] `/options`: show active sessions/devices, last active time.
  - [ ] Support “log out this device” and “log out all devices”.
- [ ] Per-user chat history (already stored) surfaced cleanly in UI.
- [ ] Optional: user switching UX improvements (avatars, last-used account number).

### v0.4 — Performance & Streaming

- [ ] Stream tokens to the UI (server → client) so long responses feel instant.
- [ ] Improve queue cancellation semantics with real interruption (if supported) or worker isolation.
- [ ] Faster cold start:
  - [ ] Background warmup + more predictable “ready” status.
  - [ ] Cache contexts safely if supported.
- [ ] Better context control:
  - [ ] Adaptive prompt/history trimming with sane defaults.
  - [ ] Configurable context size per model profile.

### v0.5 — Frontend Unification & Cleanup

- [ ] Unify page layout patterns (main → login → options → setup) while preserving visuals.
- [ ] Move shared UI behaviors to `/shared/ui.js` (theme, toasts, session helpers, preload handling).
- [ ] Reduce duplicated CSS across pages and remove unused selectors.
- [ ] Accessibility pass: keyboard navigation, focus states, ARIA labels for controls.

## Backlog / Ideas

- Voice input/output (local speech-to-text and TTS).
- WhatsApp/Discord connectors (optional, opt-in).
- Notes enhancements: tagging, search, pinning, export/import.
- Simple “memory” system with explicit user control and per-user scope.

## Tech Debt Watchlist

- Keep `README.md` in sync with actual routes and folder structure.
- Add a minimal smoke-test script (start server, hit `/api/users/status`, `/api/chat/history`, `/api/notes`).
- Add a schema migration strategy that’s clearly documented and safe to run on startup.

