import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { registerChatRoutes } from './api/chatRoutes.js';

dotenv.config({ quiet: true });
const PORT = process.env.WEB_PORT;    
const DEBUG = process.env.DEBUG_MODE;    

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();                                  // Find the specified port from the applications enviroment
app.use(cors());														// Enable CORS for all routes
app.use(express.json());                                                // Parse JSON bodies (needed for req.body)
app.use(express.static(path.join(__dirname, "web")));					// Serve static files from /web/public
app.use("/phosphor", express.static( path.join(__dirname, "..", "node_modules", "@phosphor-icons", "web"))); // Serve Phosphor icons (from node_modules

// API routes
registerChatRoutes(app);

// Start the server
app.listen(PORT, () => {
  console.log(`Ava is running on http://localhost:${PORT}`);
});
