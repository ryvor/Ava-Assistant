# Ava Development Roadmap

## Legend
 - ❓ Possible feature
 - ⏳ Not started
 - 🔄 In progress
 - ✅ Done
 - ⚠️ Issue

---

## 🎯 Milestone 1 - Core Skeleton Online

*Ava can receive a message and reply with a hard-coded response.*

### Phase 1.1 - Project & Core Services
 - ✅ Initialise Ava repo & base folder structure
 - ✅ Set up Node + TypeScript project for the orchestrator
 - ✅ Add a basic Express (or Fastify) HTTP server
 - ✅ Create a POST /chat endpoint that echoes a test response

### Phase 1.2 - Simple CLI & Local Only
 - ✅ Create a small Node CLI client that sends text to /chat
 - ✅ Confirm end-to-end flow: CLI -> Node -> reply
 - ✅ Add basic logging so you can see requests & responses

---

## 🎯 Milestone 2 - NLU Integration (Ava Understands You)

*Ava can recognise core intents and entities locally via Rasa.*

### Phase 2.1 - Rasa Setup
 - ✅ Install Rasa and create a new Rasa project
 - ✅ Define initial intents: greet, small_talk, order_food, book_taxi, document_question
 - ✅ Add ~10-15 example phrases per intent
 - ✅ Add key entities: dish, cuisine, restaurant_name, price_preference, datetime
 - ✅ Train and run the Rasa server locally

### Phase 2.2 - Node <--> Rasa Bridge
 - ✅ Create a small NLU client in Node to call Rasa's /model/parse
 - ✅ Update /chat to send user text to Rasa and log back intents/entities
 - ✅ Add a confidence threshold and a simple "I'm not sure" fallback reply

---

## 🎯 Milestone 3 - Orchestrator Brain

*Ava routes different requests to different behaviours (handlers).*

### Phase 3.1 - Intent Routing
 - ✅ Design a simple Orchestrator class that takes (nluResult, userContext)
 - ✅ Implement a handler for greet and small_talk
 - ✅ Implement a stub handler for order_food (returns a fake example result)
 - ✅ Implement a stub handler for book_taxi (returns a fake example result)
 - ✅ Implement a stub handler for document_question

### Phase 3.2 - Low-Confidence Active Learning
 - ✅ Add logic: if intent confidence is low -> ask user "Did you mean X?"
 - ✅ Store low-confidence messages in a DB table for later review/labelling
 - ✅ Implement a simple "yes/no/never mind" clarification flow

---

## 🎯 Milestone 4 - Personalisation & Style

*Ava starts talking more like you and remembers basic context.*

### Phase 4.1 - User & Memory Basics
 - ✅ Add a users table and a simple user lookup by ID/phone
 - ✅ Add a basic conversation_memory or user_context table
 - ✅ Store last interaction time and a simple message count per user

### Phase 4.2 - Style Profile
 - ✅ Create a style_profile table (formality, emoji use, sentence length, etc.)
 - ✅ Add a basic style analyser that inspects each user message (formal vs casual, emoji, etc.)
 - ✅ Update the style profile over time using a moving average

### Phase 4.3 - Response Generation Layer
 - ✅ Create a respond(label, context) function in the orchestrator
 - ✅ Implement personalised greetings using time of day + style profile
 - ✅ Implement natural confirmations (e.g. "All sorted", "Done", "Gotcha")
 - ✅ Implement friendly clarification responses for low-confidence cases

---

## 🎯 Milestone 5 - Web User interface

*Ava gets a proper browser-based chat client (secure, multi-user, clean UI).*

### Phase 5.1 - Basic Web Chat UI
 - ✅ Create web/ folder with a minimal SPA (HTML/CSS/JS or React lite-bundle)
 - ✅ Implement a message list + scrolling container
 - ✅ Add input bar with "send" button + Enter to send
 - 🔄 Show streaming states (e.g. Ava is typing...)
 - ✅ Connect frontend -> /api/chat using POST calls
 - ✅ Render Ava + user messages with different styles

### Phase 5.2 - UI Architecture & Styling
 - ✅ Introduce a clean design system (colours, spacing, typography)
 - ✅ Add message bubbles
 - ✅ with avatars or initials
 - ⏳ Implement theming (dark/light or Ava purple theme)
 - ✅ Add layout for desktop + mobile (responsive)
 - ✅ Style friendly errors ("Ava couldn't reach the NLU server", etc.)

### Phase 5.3 - Channel Identity & Backend Binding
 - ✅ Web UI no longer chooses the account_number (security hardening)
 - ✅ For now: generate a temporary web user cookie (UUID)
 - ✅ Later: login -> assign stable DB user
 - ✅ Ensure all requests from Web include correct backend channel: "web"
 - ✅ Verify admin-only intents cannot execute from Web

### Phase 5.4 - Conversation History
 - ✅ Persist conversation history rows in DB
 - ⏳ Add /api/history endpoint to fetch last X messages per user
 - ⏳ Display previous conversation on page load
 - ⏳ Add timestamps + user alignment
 - ⏳ Add lazy-load older messages (optional improvement)

### Phase 5.5 - Web UI Polish
 - ✅ Auto-scroll behaviour controlled + smooth
 - ✅ Graceful error boxes
 - ⏳ Animations (fade-in messages, bubble expansion)
 - ⏳ Clean loading states (dots, pulse, etc.)
 - ⏳ Add "Clear conversation" button (resets backend memory for that user)

---

## 🎯 Milestone 6 - User Account Control

### Phase 6.1 - Web Authentication Foundation
 - ⏳ Add registration API (/api/register)
 - ✅ Add login API (/api/login)
 - ✅ Add logout API (/api/logout)
 - ✅ Store password hashes using bcrypt
 - ✅ Issue signed cookies or JWTs (local-only, no external calls)
 - 🔄 Protect /api/chat so only authenticated web users can message Ava

### Phase 6.2 - User Context Binding
 - 🔄 When a web request arrives, resolve user via auth cookie
 - 🔄 Set UserContext:
  - 🔄 account_number: <db user id>
  - ✅ displayName
  - 🔄 channel: "web"
 - ✅ isAdmin: false
  - ✅ Ensure Ava memory (style, conversation_memory) is per-user not global
  - ⏳ Add DB column for source ("web", "cli", future "whatsapp", etc.)

### Phase 6.3 - CLI Admin Privileges
 - ✅ Update CLI to always set:
  - ✅ channel: "cli"
  - ✅ isAdmin: true
  - ✅ account_number: "cli-admin"
 - ✅ Harden backend so admin intents only work when:
  - ✅ user.channel === "cli"
  - ✅ user.account_number === "cli-admin"
  - ✅ user.isAdmin === true
 - 🔄 Add admin-only CLI commands:
 - 🔄 list-users
 - 🔄 delete-user <id>
 - 🔄 reset-password <id>

### Phase 6.4 - Ava's Account-Management Intents
*(Only obeyed from CLI - strictly blocked from Web or any external channel)*
 - ✅ Implement NLU intents:
  - ✅ create_user
  - ✅ delete_user
  - ✅ modify_user
  - ✅ change_admin_password
 - ✅ Ensure handler checks channel + isAdmin
 - ✅ Fully implement:
  - ✅ create_user -> uses DB + ensureUser
  - ✅ delete_user -> DB delete
  - ✅ modify_user -> password reset or update fields
  - ✅ change_admin_password -> regenerate bcrypt -> print new hash
 - ✅ Add confirmation responses ("User created", "Password reset", etc.)

### Phase 6.5 - Web User Settings Page
 *(Optional, but a natural follow-up)*
 - ⏳ Add /settings page for logged-in user
 - ⏳ Change display name
 - ⏳ Reset own password
 - ⏳ View conversation history
 - ⏳ Toggle privacy settings (delete memory, clear style profile, etc.)

---

## 🎯 Milestone 7 - Local Document Understanding

*Ava can read a document you upload and answer simple questions about it.*

### Phase 7.1 - Document Storage & Text Extraction
 - ⏳ Create a documents table for file metadata and extracted text
 - ⏳ Add a local file upload endpoint (web or CLI pointing to a file)
 - ⏳ Integrate a local text extractor (PDF and plain text first)
 - ⏳ Save extracted text into the DB and mark it as the user's "active document"

### Phase 7.2 - Basic Document Q&A
 - ⏳ Extend document_question intent training (e.g. "what does this say?", "do they have burgers?", "what is this in GBP?")
 - ⏳ In the document_question handler, load the active document's text
 - ⏳ Implement simple "contains item" checks (e.g. search for "burger" lines)
 - ⏳ Implement a basic "summarise this" behaviour (truncate or simple keyword summary)
 - ⏳ Implement simple currency detection + conversion logic (with an optional offline or whitelisted FX source)

---

## 🎯 Milestone 8 - Privacy & Safety Hardening

*Ava becomes a tightly locked-down, local-first assistant.*

### Phase 8.1 - Data Handling & Retention
 - ⏳ Add a 30-day retention policy for uploaded files + documents
 - ⏳ Implement a daily cleanup job that deletes old files and DB rows
 - ⏳ Ensure logs do not contain sensitive document content or secrets

### Phase 8.2 - Network & Egress Control
 - ⏳ Centralise all external HTTP calls into a safeFetch helper
 - ⏳ Restrict allowed hostnames to a strict whitelist
 - ⏳ Add firewall rules / router rules to block outbound traffic except to whitelisted services (or none at all for now)

### Phase 8.3 - Config & Modes
 - ⏳ Add a config flag for "offline-only" mode vs "allow-online-lookups"
 - ⏳ Make online lookup intents explicitly opt-in ("look this up online")
 - ⏳ Add clear logging whenever Ava goes online for transparency

---

## 🎯 Milestone 9 - Conversational Ava

*Ava can chat naturally, not just execute commands.*

### Phase 9.1 - Small Talk & Dialog Moves
 - ⏳ Improve small_talk training data (examples of "how are you", "I'm bored", "talk to me", etc.)
 - ✅ Add a small_talk handler that chooses between greeting, empathising, asking a question, or reacting
 - ✅ Make small-talk responses adapt to the user's style profile (formal vs casual, emoji use, etc.)

### Phase 9.2 - Light Conversation Memory
 - ⏳ Store recent topics/keywords in conversation_memory
 - ⏳ Add callbacks like "how did that trip go?" based on previous mentions
 - ⏳ Make Ava optionally ask simple follow-up questions to keep chat flowing

---

## 🎯 Milestone 10 - Emotive, Empathic Ava

*Ava can respond with warmth, empathy, and human-like emotional cues.*

### Phase 10.1 - Emotion & Sentiment Sensing
 - ⏳ Add a lightweight sentiment/emotion classifier on each user turn (happy, sad, stressed, excited, neutral)
 - ⏳ Store recent emotion trend in memory to avoid whiplash responses
 - ⏳ Detect sensitive moments (grief, anger, frustration) and trigger safe modes

### Phase 10.2 - Response Tone & Voice
 - ⏳ Expand response templates with empathetic variants per emotion (supportive, celebratory, calming, curious)
 - ⏳ Add prosody/tone controls: mirroring user formality, softness vs directness, and optional emoji warmth
 - ⏳ Layer short follow-ups that show care (“want to tell me more?”, “that sounds tough—how can I help?”)

### Phase 10.3 - Safety & Evaluation
 - ⏳ Add guardrails to avoid medical/therapeutic claims; redirect to safe resources when needed
 - ⏳ Add opt-in toggle for emotive mode per user (respect privacy/comfort)
 - ⏳ Run a qualitative checklist on sample chats to tune empathy balance (warmth vs brevity)

---

## 🎯 Milestone 11 - Localisation

*Systematically “de-English” Ava.*

### Phase 11.1 - Language Plumbing
 - ⏳ Add language to UserContext and persist per user
 - ⏳ Make langLoader multi-language and add `t(user, key, vars)` helper
 - ⏳ Move hard-coded strings in respond/handlers/CLI into language packs

### Phase 11.2 - Core Experiences
 - ⏳ Localise greetings, clarifications, confirmations, and admin replies
 - ⏳ Add language-aware formatting for dates, times, currency, and names
 - ⏳ Add a lightweight per-language QA pass for tone, politeness, and emojis
