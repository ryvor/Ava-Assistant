import { z } from "zod";
import type { ToolDefinition } from "./types.js";

export const tool: ToolDefinition = {
  name: "PLAY_GAME",
  description: "Play a word game with the user.",
  paramsSchema: z.object({
    game: z.string(),
  }),
};
