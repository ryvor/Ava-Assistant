import { createHash } from "crypto";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { debugLog } from "../utils/debug.js";

type TtsResult = { id: string; filePath: string; durationSec?: number };

const cacheDir = path.resolve(process.cwd(), "data", "tts-cache");
fs.mkdirSync(cacheDir, { recursive: true });

const pendingJobs = new Map<string, Promise<TtsResult>>();

function hashText(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

function pySafe(value: string): string {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function getSupertonicConfig() {
    const enabled = (process.env.SUPERTONIC_ENABLED ?? "true").toLowerCase() !== "false";
    const python = process.env.SUPERTONIC_PYTHON || "python";
    const voice = process.env.SUPERTONIC_VOICE || "M1";
    const stepsRaw = Number.parseInt(process.env.SUPERTONIC_STEPS ?? "5", 10);
    const steps = Number.isFinite(stepsRaw) && stepsRaw > 0 ? stepsRaw : 5;
    const speedRaw = Number.parseFloat(process.env.SUPERTONIC_SPEED ?? "1.05");
    const speed = Number.isFinite(speedRaw) && speedRaw > 0 ? speedRaw : 1.05;
    return { enabled, python, voice, steps, speed };
}

export function getCachedSupertonicPath(id: string): string | null {
    if (!/^[a-f0-9]{32}$/i.test(id)) return null;
    const filePath = path.join(cacheDir, `${id}.wav`);
    return fs.existsSync(filePath) ? filePath : null;
}

export async function synthesizeSupertonic(text: string): Promise<TtsResult> {
    const clean = (text || "").trim();
    if (!clean) {
        throw new Error("No text provided for TTS.");
    }
    const { enabled } = getSupertonicConfig();
    if (!enabled) {
        throw new Error("Supertonic TTS is disabled.");
    }

    const id = hashText(clean);
    const cachedPath = getCachedSupertonicPath(id);
    if (cachedPath) {
        return { id, filePath: cachedPath };
    }

    const existing = pendingJobs.get(id);
    if (existing) {
        return existing;
    }

    const job = runSupertonicJob(clean, id);
    pendingJobs.set(id, job);
    try {
        return await job;
    } finally {
        pendingJobs.delete(id);
    }
}

async function runSupertonicJob(text: string, id: string): Promise<TtsResult> {
    const config = getSupertonicConfig();
    const targetPath = path.join(cacheDir, `${id}.wav`);
    await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
    const safeVoice = pySafe(config.voice);

    const pyScript = `
import json
import sys
import traceback

try:
    text = sys.stdin.read()
    if not text.strip():
        raise ValueError("No text received")
    from supertonic import TTS
    tts = TTS(auto_download=True)
    voice_style = tts.get_voice_style("${safeVoice}")
    wav, dur = tts.synthesize(
        text,
        voice_style=voice_style,
        total_steps=${config.steps},
        speed=${config.speed}
    )
    tts.save_audio(wav, r"${targetPath}")
    print(json.dumps({"duration": float(dur[0])}))
except Exception as exc:
    traceback.print_exc()
    sys.stderr.write(str(exc))
    sys.exit(1)
`;

    return new Promise<TtsResult>((resolve, reject) => {
        const child = spawn(config.python, ["-c", pyScript], {
            stdio: ["pipe", "pipe", "pipe"],
            env: { ...process.env, PYTHONUNBUFFERED: "1" },
        });

        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString();
        });
        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();
        });
        child.on("error", (err) => reject(err));
        child.on("close", (code) => {
            if (code === 0 && fs.existsSync(targetPath)) {
                let duration: number | undefined;
                try {
                    const parsed = JSON.parse(stdout.trim());
                    const dur = Number(parsed?.duration);
                    if (Number.isFinite(dur)) duration = dur;
                } catch (err) {
                    debugLog("debug", "Could not parse Supertonic duration:", err);
                }
                resolve({ id, filePath: targetPath, durationSec: duration });
            } else {
                const message = stderr || stdout || "Unknown TTS error";
                reject(new Error(`Supertonic exited with code ${code}: ${message}`));
            }
        });

        child.stdin.write(text);
        child.stdin.end();
    });
}
