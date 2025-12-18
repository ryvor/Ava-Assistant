import { z } from "zod";
import type { ToolDefinition } from "./types.js";

export const tool: ToolDefinition = {
  name: "BOOK_TAXI",
  description: "Book or plan a taxi/ride for the user.",
  paramsSchema: z.object({
    pickup: z.string().nullable(),
    destination: z.string().nullable(),
    time: z.string().nullable(), // keep simple for now
    passengers: z.number().int().positive().nullable(),
    notes: z.string().nullable(),
  }),
};
