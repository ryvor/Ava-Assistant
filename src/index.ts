import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { registerChatRoutes } from './api/chatRoutes.js';
import { registerUserRoutes } from './api/userRoutes.js';
import { registerNotesRoutes } from './api/notesRoutes.js';
import { warmTextModel } from './llm/textEngine.js';
import { hasAdminUser } from './db/database.js';
import { debugLog } from './utils/debug.js';
import { Bonjour } from "bonjour-service";
import IP from 'ip';
import os from 'os';

// Load environment variables from .env file
dotenv.config({ quiet: true });

const PORT = Number(process.env.WEB_PORT ?? 3000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Warm up the text model on server start
debugLog("info", "Text model warming up.");
await warmTextModel();
debugLog("info", "Text model warmed up and ready.");

const app = express();
// Enable CORS for all routes
app.use(cors());
// Parse JSON bodies (needed for req.body)
app.use(express.json());
// Serve Phosphor icons (from node_modules
app.use("/phosphor", express.static( path.join(__dirname, "..", "node_modules", "@phosphor-icons", "web")));
// Shared assets available to all clients
app.use("/shared", express.static(path.join(__dirname, "web", "public")));
// Options/settings page
app.use("/options", express.static(path.join(__dirname, "web", "options")));
// Notes page
app.use("/notes", express.static(path.join(__dirname, "web", "notes")));
// Login page
app.use("/login", express.static(path.join(__dirname, "web", "login")));
const adminUserExists = hasAdminUser();
if (adminUserExists) {
  debugLog("debug", "Admin user found. Serving main client.");
  app.use(express.static(path.join(__dirname, "web", "main")));
} else {
  debugLog("info", "No admin user found. Serving setup client.");
  app.use(express.static(path.join(__dirname, "web", "setup")));
}

// API routes
registerUserRoutes(app);
registerChatRoutes(app);
registerNotesRoutes(app);

const hostname = os.hostname();
const localDomain = `${hostname}.local`.toLowerCase();
const hostAddress = IP.address();

// Start the server
const server = app.listen(PORT, "0.0.0.0", () => {
  const portSuffix = PORT === 80 ? '' : `:${PORT}`;
  debugLog("info", "----------------------------");
  debugLog("info", "Welcome to Ava!");
  debugLog("info", `Ava is running on:`);
  debugLog("info", `http://${localDomain}${portSuffix}/`);
  debugLog("info", `http://${hostAddress}${portSuffix}/`);
  debugLog("info", "----------------------------");
});

const bonjour = new Bonjour();
bonjour.publish({
  name: "Ava",
  type: "http",
  port: PORT,
  host: localDomain,
  txt: {
    app: "ava",
    version: "1.0",
    ui: "web",
  },
});

let isShuttingDown = false;
const shutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  debugLog("info", `Received ${signal}. Shutting down...`);
  try {
    await bonjour.unpublishAll();
  } catch (err) {
    debugLog("warn", 'Bonjour unpublish failed:', err);
  }
  try {
    bonjour.destroy();
  } catch (err) {
    debugLog("warn", 'Bonjour destroy failed:', err);
  }
  try {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  } catch (err) {
    debugLog("warn", 'Server close failed:', err);
  }
  // Let the event loop drain; ensure a clean exit code
  process.exitCode = 0;
};

process.on("SIGINT", () => { void shutdown('SIGINT'); });
process.on("SIGTERM", () => { void shutdown('SIGTERM'); });
