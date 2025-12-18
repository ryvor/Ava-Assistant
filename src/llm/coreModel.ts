import { getLlama } from "node-llama-cpp";
import { debugLog } from "../utils/debug.js";
import { fileURLToPath } from 'url';
import path from "path";
import os from "os";
import fs from "fs";
import { getGpuLayers, getGpuMode } from "../core/backendPolicy.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ModelSpec = { id: string; minRamGB: number; path: string };

function getRamGB() {
    return os.totalmem() / 1024 / 1024 / 1024;
}

function loadSpecs(): ModelSpec[] {
    const jsonEnv = process.env.AVA_MODELS_JSON;
    const folderEnv = __dirname;
    let specs: ModelSpec[] = [];

    if (jsonEnv && jsonEnv.trim()) {
        specs = JSON.parse(jsonEnv.trim()) as ModelSpec[];
    } else {
        const fallback = path.resolve(process.cwd(), "models.json");
        if (!fs.existsSync(fallback)) {
            throw new Error("No model specs found. set AVA_MODELS_JSON or add models.json.");
        }
        const raw = fs.readFileSync(fallback, "utf-8");
        specs = JSON.parse(raw) as ModelSpec[];
    }

    specs.sort((a, b) => a.minRamGB - b.minRamGB);
    return specs.map((s) => {
        const modelFile = s.path;
        const fullPath = path.isAbsolute(modelFile)
            ? modelFile
            : path.resolve(folderEnv, "..", "..", "models", modelFile);
        return { ...s, path: fullPath };
    });
}

let _model: any | null = null;
let _loading: Promise<any> | null = null;

export async function getTextModel() {
    if (_model) return _model;
    if (_loading) return _loading;

    _loading = (async () => {
        const ramGB = getRamGB();
        const specs = loadSpecs();
        if (!specs.length) {
            throw new Error("No model specs available");
        }
        const ramInfo = `RAM: ${ramGB.toFixed(1)}GB`;
        debugLog("info", ramInfo);

        const eligible = specs.filter((s) => ramGB >= s.minRamGB);
        const attempts = eligible.length ? eligible : specs;

        const llama = await getLlama();
        const gpuMode = getGpuMode();
        const gpuLayers = gpuMode === "off" ? 0 : getGpuLayers();
        let lastErr: unknown;
        for (let i = attempts.length - 1; i >= 0; i -= 1) {
            const candidate = attempts[i];
            try {
                debugLog("debug", `Trying model: ${candidate.id} (>=${candidate.minRamGB}GB) @ ${candidate.path}`);
                if (!fs.existsSync(candidate.path)) {
                    debugLog("warn", `Missing model file: ${candidate.path}`);
                    continue;
                }
                _model = await llama.loadModel({
                    modelPath: candidate.path,
                    gpuLayers,
                });
                debugLog("info", `Loaded model: ${candidate.id} (gpuMode=${gpuMode}, layers=${gpuLayers})`);
                return _model;
            } catch (err) {
                lastErr = err;
                debugLog("warn", `Failed to load model ${candidate.id}: ${err}`);
            }
        }
        throw new Error(`No model could be loaded. Last error: ${lastErr}`);
    })();

    return _loading;
}
