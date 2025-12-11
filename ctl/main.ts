// ava/server.ts
import express from "express";
import { Orchestrator } from "./orchestrator/Orchestrator";
import dotenv from "dotenv";

dotenv.config({ quiet: true });
const app = express();
const orchestrator = new Orchestrator();

const PORT = process.env.AVA_PORT;

app.use(express.json());

/*
app.post("/chat", async (req, res) => {
  try {
    const { text, account_number } = req.body;
    if (typeof text !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'text' field" });
    }
    const uid = typeof account_number === "number" ? account_number : -1;

    const response = await orchestrator.handleMessage(text, { account_number: uid, channel });
    res.json(response);
  } catch (err) {
    console.error("Error in /chat:", err);
    res.status(500).json({ error: "Internal server error, " + err });
  }
});
*/



app.listen(PORT, () => {
  console.log(`Ava orchestrator listening on http://localhost:${PORT}`);
});
