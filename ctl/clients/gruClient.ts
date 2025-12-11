// ava/orchestrator/gruClient.ts
import fetch from "node-fetch";

export interface GruStyle {
  // for future use
  formality?: number;
  emojiUsage?: number;
  sentenceLength?: number;
}

export interface GruSlots {
  [key: string]: string | number | null;
}

export async function generateGruSkeleton(
  label: string,
  style?: GruStyle,
  slots?: GruSlots
): Promise<string> {
  try {
    const res = await fetch("http://127.0.0.1:5006/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, style, slots }),
    });

    if (!res.ok) {
      console.error("GRU service error:", await res.text());
      return "[GRU error]";
    }

    const data = (await res.json()) as { skeleton: string };
    return data.skeleton;
  } catch (err) {
    console.error("GRU service unreachable:", err);
    return "[GRU unavailable]";
  }
}
