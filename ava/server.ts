// ava/server.ts
import express from "express";
import { Orchestrator } from "./orchestrator/Orchestrator";

const app = express();
const orchestrator = new Orchestrator();

const PORT = process.env.PORT || 4000;

app.use(express.json());

app.post("/chat", async (req, res) => {
  try {
    const { text, userId } = req.body;
    if (typeof text !== "string") {
      return res.status(400).json({ error: "Missing or invalid 'text' field" });
    }
    const uid = typeof userId === "string" ? userId : "cli-admin";

    const response = await orchestrator.handleMessage(text, { userId: uid });
    res.json(response);
  } catch (err) {
    console.error("Error in /chat:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});



app.listen(PORT, () => {
  console.log(`Ava orchestrator listening on http://localhost:${PORT}`);
});
