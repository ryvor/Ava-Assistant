import { z } from "zod";
import type { ToolDefinition } from "./types.js";

export const tool: ToolDefinition = {
  name: "CREATE_REMINDER",
  description: "Create a reminder for the user using cron.",
  paramsSchema: z.object({
    content: z.string(),
    is_repeating: z.boolean(),
    cron_timescale: z.string().nullable(),
  }),
};
