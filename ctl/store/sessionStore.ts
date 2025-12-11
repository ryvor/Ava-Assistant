// ava/store/sessionStore.ts
import { db } from "../db";
import bcrypt from "bcryptjs";

const insertSession = db.prepare(`
  INSERT INTO sessions (account_number, active, token, created_at, expires_at, revoked_at)
  VALUES (@account_number, @active, @token, @created_at, @expires_at, NULL)
`);

const getSessionById = db.prepare(`
  SELECT account_number, token, created_at, expires_at, revoked_at
  FROM sessions
  WHERE token = ?
`);

const deactivateExpiredSessionStmt = db.prepare(`
  UPDATE sessions SET active = 'FALSE' WHERE token = ?
`);

const revokeSessionStmt = db.prepare(`
  UPDATE sessions SET revoked_at = @revoked_at, active = 'FALSE' WHERE token = @token
`);

export function createSession(account_number: number, token: string, ttlHours = 12) {
  const now = new Date();
  const expires = new Date(now.getTime() + ttlHours * 3600 * 1000);
  insertSession.run({
    account_number,
    token: token,
    active: "TRUE",
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
  });
}

export function revokeSession(token: string) {
  revokeSessionStmt.run({ token, revoked_at: new Date().toISOString() });
}

export async function validateSession(token: string) {
  const row = getSessionById.get(token) as any;
  if (!row) return null;
  if (row.revoked_at) return null;
  if (new Date(row.expires_at) < new Date())  {
    deactivateExpiredSessionStmt.run(token);
    return null;
  }
  return {
    token: row.token,
    account_number: row.account_number
};
}
