import { UserContext } from "../types/context";
import { Orchestrator } from "./Orchestrator";
import { getUser } from "../store/userStore";
import { createSession, validateSession } from "../store/sessionStore";

// ava/src/orchestrator/webEntry.ts

export interface AvaRequest {
  account_number: number;
  message: string;
}

export interface AvaResponse {
  reply: string;
  intent?: string;
  confidence?: number;
}

export async function handleWebMessage(req: AvaRequest): Promise<AvaResponse> {
  const { account_number, message } = req;
  // Build a minimal UserContext for now
  var userData = getUser(account_number);
  if(userData == null) return {
    reply: "User not found."
  };
  //
  const user: UserContext = {
    account_number,
    displayName: userData.display_name,
		channel: "web",
		isAdmin: false,
    language: "en_GB",
  };

  // Reuse your main orchestrator brain
  const orchestrator = new Orchestrator();

  // Let the orchestrator do NLU, style, routing, etc.
  const result = await orchestrator.handleMessage(message, user);

  return {
    reply: result.reply,
  };
}

export function userValidation(accountNumber: number) {
    return getUser(accountNumber);
}

export function newSession(account_number: number, tokenHash: string) {
  createSession(account_number, tokenHash);
}

export async function confirmSession(token: string) {
  return validateSession(token);
}
