import type { ToolDefinition } from "./types.js";

// Explicit imports are the most reliable (and bundler-friendly)
import { tool as orderFood } from "./order_food.js";
import { tool as bookTaxi } from "./book_taxi.js";
// later: import { tool as describeImage } from "./describe_image.js";

const tools: ToolDefinition[] = [
  orderFood,
  bookTaxi,
  // describeImage,
];

export function getTools(): ToolDefinition[] {
  return tools;
}
