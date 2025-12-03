# Ava Development Roadmap

## Legend
	•	⏳ Not started
	•	🔄 In progress
	•	✅ Done

⸻

## 🎯 Milestone 1 — Core Skeleton Online

*Ava can receive a message and reply with a hard-coded response.*

### Phase 1.1 — Project & Core Services
	•	⏳ Initialise Ava repo & base folder structure
	•	⏳ Set up Node + TypeScript project for the orchestrator
	•	⏳ Add a basic Express (or Fastify) HTTP server
	•	⏳ Create a POST /chat endpoint that echoes a test response

### Phase 1.2 — Simple CLI & Local Only
	•	⏳ Create a small Node CLI client that sends text to /chat
	•	⏳ Confirm end-to-end flow: CLI → Node → reply
	•	⏳ Add basic logging so you can see requests & responses

⸻

## 🎯 Milestone 2 — NLU Integration (Ava Understands You)

*Ava can recognise core intents and entities locally via Rasa.*

### Phase 2.1 — Rasa Setup
	•	⏳ Install Rasa and create a new Rasa project
	•	⏳ Define initial intents: greet, small_talk, order_food, book_uber, document_question
	•	⏳ Add ~10–15 example phrases per intent
	•	⏳ Add key entities: dish, cuisine, restaurant_name, price_preference, datetime
	•	⏳ Train and run the Rasa server locally

### Phase 2.2 — Node ↔ Rasa Bridge
	•	⏳ Create a small NLU client in Node to call Rasa’s /model/parse
	•	⏳ Update /chat to send user text to Rasa and log back intents/entities
	•	⏳ Add a confidence threshold and a simple “I’m not sure” fallback reply

⸻

#% 🎯 Milestone 3 — Orchestrator Brain

*Ava routes different requests to different behaviours (handlers).*

### Phase 3.1 — Intent Routing
	•	⏳ Design a simple Orchestrator class that takes (nluResult, userContext)
	•	⏳ Implement a handler for greet and small_talk
	•	⏳ Implement a stub handler for order_food (returns a fake example result)
	•	⏳ Implement a stub handler for book_uber (returns a fake example result)
	•	⏳ Implement a stub handler for document_question

### Phase 3.2 — Low-Confidence Active Learning
	•	⏳ Add logic: if intent confidence is low → ask user “Did you mean X?”
	•	⏳ Store low-confidence messages in a DB table for later review/labelling
	•	⏳ Implement a simple “yes/no/never mind” clarification flow

⸻

## 🎯 Milestone 4 — Personalisation & Style

*Ava starts talking more like you and remembers basic context.*

### Phase 4.1 — User & Memory Basics
	•	⏳ Add a users table and a simple user lookup by ID/phone
	•	⏳ Add a basic conversation_memory or user_context table
	•	⏳ Store last interaction time and a simple message count per user

### Phase 4.2 — Style Profile
	•	⏳ Create a style_profile table (formality, emoji use, sentence length, etc.)
	•	⏳ Add a basic style analyser that inspects each user message (formal vs casual, emoji, etc.)
	•	⏳ Update the style profile over time using a moving average

### Phase 4.3 — Response Generation Layer
	•	⏳ Create a respond(label, context) function in the orchestrator
	•	⏳ Implement personalised greetings using time of day + style profile
	•	⏳ Implement natural confirmations (e.g. “All sorted”, “Done”, “Gotcha”)
	•	⏳ Implement friendly clarification responses for low-confidence cases

⸻

## 🎯 Milestone 5 — Local Document Understanding

*Ava can read a document you upload and answer simple questions about it.*

### Phase 5.1 — Document Storage & Text Extraction
	•	⏳ Create a documents table for file metadata and extracted text
	•	⏳ Add a local file upload endpoint (web or CLI pointing to a file)
	•	⏳ Integrate a local text extractor (PDF and plain text first)
	•	⏳ Save extracted text into the DB and mark it as the user’s “active document”

### Phase 5.2 — Basic Document Q&A
	•	⏳ Extend document_question intent training (e.g. “what does this say?”, “do they have burgers?”, “what is this in GBP?”)
	•	⏳ In the document_question handler, load the active document’s text
	•	⏳ Implement simple “contains item” checks (e.g. search for “burger” lines)
	•	⏳ Implement a basic “summarise this” behaviour (truncate or simple keyword summary)
	•	⏳ Implement simple currency detection + conversion logic (with an optional offline or whitelisted FX source)

⸻

## 🎯 Milestone 6 — Privacy & Safety Hardening

*Ava becomes a tightly locked-down, local-first assistant.*

### Phase 6.1 — Data Handling & Retention
	•	⏳ Add a 30-day retention policy for uploaded files + documents
	•	⏳ Implement a daily cleanup job that deletes old files and DB rows
	•	⏳ Ensure logs do not contain sensitive document content or secrets

### Phase 6.2 — Network & Egress Control
	•	⏳ Centralise all external HTTP calls into a safeFetch helper
	•	⏳ Restrict allowed hostnames to a strict whitelist
	•	⏳ Add firewall rules / router rules to block outbound traffic except to whitelisted services (or none at all for now)

### Phase 6.3 — Config & Modes
	•	⏳ Add a config flag for “offline-only” mode vs “allow-online-lookups”
	•	⏳ Make online lookup intents explicitly opt-in (“look this up online”)
	•	⏳ Add clear logging whenever Ava goes online for transparency

⸻

## 🎯 Milestone 7 — Conversational Ava

*Ava can chat naturally, not just execute commands.*

### Phase 7.1 — Small Talk & Dialog Moves
	•	⏳ Improve small_talk training data (examples of “how are you”, “I’m bored”, “talk to me”, etc.)
	•	⏳ Add a small_talk handler that chooses between greeting, empathising, asking a question, or reacting
	•	⏳ Make small-talk responses adapt to the user’s style profile (formal vs casual, emoji use, etc.)

### Phase 7.2 — Light Conversation Memory
	•	⏳ Store recent topics/keywords in conversation_memory
	•	⏳ Add callbacks like “how did that trip go?” based on previous mentions
	•	⏳ Make Ava optionally ask simple follow-up questions to keep chat flowing
