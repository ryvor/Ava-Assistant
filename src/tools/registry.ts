import type { ToolDefinition } from "./types.js";

// Explicit imports are the most reliable (and bundler-friendly)
import { tool as orderFood } from "./order_food.js";
import { tool as bookTaxi } from "./book_taxi.js";
import { tool as create_note } from "./create_note.js";
import { tool as create_reminder } from "./create_reminder.js";
import { tool as play_game } from "./play_game.js";
// later: import { tool as describeImage } from "./describe_image.js";

const tools: ToolDefinition[] = [
  orderFood,
  bookTaxi,
  create_note,
  create_reminder,
  play_game
  // describeImage,
];

export function getTools(): ToolDefinition[] {
  return tools;
}
