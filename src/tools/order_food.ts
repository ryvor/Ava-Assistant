import { z } from "zod";
import type { ToolDefinition } from "./types.js";

export const tool: ToolDefinition = {
  name: "ORDER_FOOD",
  description: "Help the user choose and place a food order.",
  paramsSchema: z.object({
    cuisine: z.string().nullable(),
    items: z.array(z.string()).nullable(),
    address: z.string().nullable(),
    notes: z.string().nullable(),
  }),
};
