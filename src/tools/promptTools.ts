import type { ToolDefinition } from "./types.js";
import { z } from "zod";

function describeFields(schema: z.ZodTypeAny): string[] {
  if (!(schema instanceof z.ZodObject)) return [];
  return Object.entries(schema.shape).map(([name, val]) => {
    const optional = val instanceof z.ZodNullable || val.isNullable?.() || val.isOptional?.();
    return optional ? `${name} (optional)` : name;
  });
}

export function buildToolsPrompt(tools: ToolDefinition[]) {
  return tools
    .filter((t) => t.showInPrompt !== false)
    .map((t) => {
      const fields = describeFields(t.paramsSchema);
      return `- ${t.name}: ${t.description}\n  params: ${fields.length ? fields.join(", ") : "(none)"}`;
    })
    .join("\n");
}
