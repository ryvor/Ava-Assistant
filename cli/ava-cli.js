#!/usr/bin/env node

const readline = require("readline");
const http = require("http");

const ORCHESTRATOR_URL = process.env.AVA_URL || "http://localhost:4000/chat";

function sendMessage(text) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      userId: "cli-admin",
      text
    });

    const url = new URL(ORCHESTRATOR_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (e) {
          reject(new Error("Invalid JSON from server: " + body));
        }
      });
    });

    req.on("error", (err) => reject(err));
    req.write(data);
    req.end();
  });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: "> ",
});

console.log("Ava CLI admin console. Type your message and press Enter. (Ctrl+C to exit)");
rl.prompt();

rl.on("line", async (line) => {
  const text = line.trim();
  if (!text) {
    rl.prompt();
    return;
  }

  try {
    const res = await sendMessage(text);
    console.log(`# Response: ${res.reply}`);
  } catch (err) {
    console.error("# Error:", err.message);
  }

  rl.prompt();
});

rl.on("SIGINT", () => {
  console.log("\nGoodbye.");
  process.exit(0);
});
