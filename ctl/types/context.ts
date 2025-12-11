// ava/types/context.ts

export interface UserContext {
  account_number: number;
  displayName: string;
  channel: "cli" | "web" | "other";
  isAdmin?: boolean;
  language: string;
}


export interface OrchestratorResponse {
  reply: string;
}
