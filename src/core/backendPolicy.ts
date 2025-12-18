import dotenv from "dotenv";
import { debugLog } from "../utils/debug.js";

dotenv.config({ quiet: true });

// src/model/backendPolicy.ts
export type GpuMode = "auto" | "prefer" | "off";

export function getGpuMode(): GpuMode {
  debugLog("trace", `GPU_MODE env var: ${process.env.GPU_MODE}`);
  const v = (process.env.GPU_MODE ?? "auto").toLowerCase();
  if (v === "off" || v === "prefer" || v === "auto") return v;
  return "auto";
}

export function getCtxTokens() {
  debugLog("trace", `CTX_TOKENS env var: ${process.env.CTX_TOKENS}`);
  const n = Number(process.env.CTX_TOKENS ?? "4096");
  return Number.isFinite(n) ? n : 4096;
}

export function getGpuLayers() {
  debugLog("trace", `GPU_LAYERS env var: ${process.env.GPU_LAYERS}`);
  const n = Number(process.env.GPU_LAYERS ?? "20");
  return Number.isFinite(n) ? n : 20;
}
