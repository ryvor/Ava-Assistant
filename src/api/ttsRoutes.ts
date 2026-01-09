import type { Express, Request, Response } from 'express';
import fs from "fs";
import { getCachedSupertonicPath, synthesizeSupertonic } from "../tts/supertonic.js";
import { debugLog } from "../utils/debug.js";

const AUDIO_CACHE_CONTROL = "public, max-age=31536000, immutable";

export function registerTtsRoutes(app: Express) {
    app.post("/api/tts", async (req: Request, res: Response) => {
        const text = typeof req.body?.text === "string" ? req.body.text.trim() : "";
        if (!text) {
            return res.status(400).json({ error: "text_required", message: "No text provided for TTS." });
        }
        try {
            const { id, durationSec } = await synthesizeSupertonic(text);
            const url = `/api/tts/${id}.wav`;
            return res.status(200).json({ id, url, durationSec, provider: "supertonic" });
        } catch (err) {
            const message = err instanceof Error ? err.message : "TTS failed";
            const status = message.toLowerCase().includes("disabled") ? 503 : 500;
            debugLog("warn", "Supertonic TTS failed:", message);
            return res.status(status).json({ error: "tts_failed", message });
        }
    });

    app.get("/api/tts/:file", (req: Request, res: Response) => {
        const file = req.params.file || "";
        if (!/^[a-f0-9]{32}\.wav$/i.test(file)) {
            return res.status(404).end();
        }
        const id = file.replace(/\.wav$/i, "");
        const fullPath = getCachedSupertonicPath(id);
        if (!fullPath) {
            return res.status(404).end();
        }

        res.setHeader("Content-Type", "audio/wav");
        res.setHeader("Cache-Control", AUDIO_CACHE_CONTROL);
        const stream = fs.createReadStream(fullPath);
        stream.on("error", (err) => {
            debugLog("warn", "Failed to read Supertonic audio:", err);
            res.status(500).end();
        });
        stream.pipe(res);
    });
}
