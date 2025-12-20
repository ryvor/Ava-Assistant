import { z } from "zod";

export type ToolName =
  // Done
    | "CHAT"
  // Setup
    | "ORDER_FOOD"
    | "BOOK_TAXI"
  // InDev
    | "PLAY_GAME"
    | "CREATE_NOTE"
    | "CREATE_REMINDER"
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
  // If false, the tool is hidden from prompts (but still executable if model returns it)
  showInPrompt?: boolean;
  // Optional: admin-only or special permissions later
  requiresAdmin?: boolean;
};
