import { z } from "zod";
import type { ToolDefinition } from "./types.js";
import { createNote } from "../db/database.js";

export const tool: ToolDefinition = {
  name: "CREATE_NOTE",
  description: "Create a note for the user.",
  paramsSchema: z.object({
    title: z.string(),
    content: z.string(),
  }),
};

export type NoteResult = { reply: string; reason?: string; noteId?: number };

export function executeCreateNote(
  userId: number,
  payload: { title?: string | null; content?: string | null; reason?: string },
  originalMessage: string,
  contextText?: string
): NoteResult {
  const content = (payload.content ?? "").toString().trim();
  const titleRaw = (payload.title ?? "").toString().trim();

  const body =
    content ||
    originalMessage ||
    (contextText ?? "").toString().trim() ||
    "Note created from chat.";
  const title =
    titleRaw ||
    (body.length > 60 ? `${body.slice(0, 57)}...` : body) ||
    "New note";

  const note = createNote(userId, title, body, Date.now());
  const reply = `Created a note: "${note.title}".`;
  return { reply, reason: payload.reason, noteId: note.id };
}
