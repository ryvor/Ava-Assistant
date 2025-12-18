import { z } from "zod";

export type ToolName =
  // Done
    | "CHAT"
  // Setup
    | "ORDER_FOOD"
    | "BOOK_TAXI"
  // InDev
    | "PLAY_GAME"
  // Pipeline
    | "WEB_SEARCH"
    | "CALCULATOR"
    | "NOTE_TAKING"
    | "REMINDERS"
    | "WEATHER_CHECKER"
    | "DESCRIBE_IMAGE"
    | "UNKNOWN";

export type ToolDefinition = {
  name: ToolName;
  description: string;
  // Zod schema for params (used for validation + prompt generation)
  paramsSchema: z.ZodTypeAny;
  // Optional: admin-only or special permissions later
  requiresAdmin?: boolean;
};
