// ava/store/accountStore.ts

import { db } from "../db";
import bcrypt from "bcryptjs";

export interface NewAccountResult {
  accountNumber: number;
  oneTimePin: string;
  displayName: string;
}

const getAccountByNumberStmt = db.prepare(`
  SELECT account_number
  FROM users
  WHERE account_number = ?
`);

const insertAccountStmt = db.prepare(`
  INSERT INTO users (
    account_number,
    display_name,
    one_time_pin_hash,
    created_at,
    account_activated
  )
  VALUES (@account_number, @display_name, @one_time_pin_hash, @created_at, @account_activated)
`);

// -------------------------------------
// Helpers: generate account & PIN
// -------------------------------------

function generateUniqueAccountNumber(): number {
  // 6-digit number: 100000–999999
  while (true) {
    const candidate = 100000 + Math.floor(Math.random() * 900000);
    const row = getAccountByNumberStmt.get(candidate) as { account_number: number } | undefined;
    if (!row) return candidate;
  }
}

function generateOneTimePin(): string {
  const n = Math.floor(Math.random() * 10000); // 0–9999
  return n.toString().padStart(4, "0");
}

// -------------------------------------
// Public API: create a new user account
// -------------------------------------

export async function createUserAccount(displayName: string): Promise<NewAccountResult> {
  const accountNumber = generateUniqueAccountNumber();
  const oneTimePin = generateOneTimePin();
  const now = new Date().toISOString();

  const pinHash = await bcrypt.hash(oneTimePin, 10);

  insertAccountStmt.run({
    account_number: accountNumber,
    display_name: displayName,
    one_time_pin_hash: pinHash,
    security_type: "PIN",
    created_at: now,
    account_activated: 0,
  });

  return {
    accountNumber,
    oneTimePin,
    displayName,
  };
}
