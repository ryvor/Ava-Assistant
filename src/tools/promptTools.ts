import type { ToolDefinition } from "./types.js";
import { z } from "zod";

function getFieldKeys(schema: z.ZodTypeAny): string[] {
  if (schema instanceof z.ZodObject) {
    return Object.keys(schema.shape);
  }
  return [];
}

export function buildToolsPrompt(tools: ToolDefinition[]) {
  return tools.map(t => {
    const fields = getFieldKeys(t.paramsSchema);
    return `- ${t.name}: ${t.description}\n  params: ${fields.length ? fields.join(", ") : "(none)"}`;
  }).join("\n");
}
