import { z } from "zod";
import type { ToolDefinition } from "./types.js";

export const tool: ToolDefinition = {
  name: "BOOK_TAXI",
  description: "Book or plan a taxi/ride for the user.",
  paramsSchema: z.object({
    pickup: z.string(),
    destination: z.string(),
    time: z.string(), // keep simple for now
    passengers: z.number().int().positive(),
    notes: z.string().nullable(),
  }),
};
