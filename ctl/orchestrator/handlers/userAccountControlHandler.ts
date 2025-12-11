// ava/orchestrator/handlers/userAccountControlHandler.ts

import { IntentHandler, HandlerContext } from "../IntentHandler";
import { OrchestratorResponse, UserContext } from "../../types/context";
import { NluResult } from "../../clients/rasaClient";
import bcrypt from "bcryptjs";
import { createUserAccount } from "../../store/accountStore";

// ---- small helpers ----

function getEntity(nlu: NluResult, name: string): string | null {
  const ent = (nlu.entities || []).find((e) => e.entity === name);
  if (!ent) return null;
  const raw = (ent as any).value ?? (ent as any).text;
  return typeof raw === "string" ? raw : null;
}

/**
 * Returns true if this request is allowed to perform admin account control.
 * Right now: only the CLI admin user.
 */
function isCliAdmin(user: UserContext): boolean {
  return user.channel === "cli" && user.isAdmin === true;
}

/**
 * Stub: where you'd actually persist admin password changes.
 * For now we just log a note to the console.
 */
async function updateCliAdminPasswordHash(newPlainPassword: string): Promise<void> {
  const hash = await bcrypt.hash(newPlainPassword, 10);
  console.log("🔐 [ADMIN] New CLI admin password hash (store this securely, e.g. in .env):");
  console.log(hash);
  console.log(
    "Remember to update ADMIN_PASSWORD_HASH / CLI_ADMIN_HASH and restart the CLI for it to take effect."
  );
}

// ---- per-intent handlers (module-level functions) ----

async function handleCreateUser(nlu: NluResult): Promise<OrchestratorResponse> {
  let displayName = getEntity(nlu, "user_identifier");

  if (!displayName) {
    return {
      reply:
        "You asked to create a user, but I didn't catch a name. Please include something like 'create a new user Example User'.",
    };
  }

  displayName = displayName.trim();

  // 🔹 Actually create the user account in the DB
  const account = await createUserAccount(displayName);

  return {
    reply:
      `New user created. ✅\n` +
      `Name: ${account.displayName}\n` +
      `Account number: ${account.accountNumber}\n` +
      `One-time access PIN: ${account.oneTimePin}\n\n` +
      `Give these to the user so they can log in on the web for the first time.`,
  };
}

async function handleDeleteUser(nlu: NluResult): Promise<OrchestratorResponse> {
  const user_name = getEntity(nlu, "user_identifier");

  if (!user_name) {
    return {
      reply:
        "You asked me to remove a user, but I didn't catch which one. Please say something like 'remove the user exampleuser'.",
    };
  }

  // TODO: implement a real deleteUser() in your userStore and call it here
  console.log(`🔧 [ADMIN] Requested delete of user "${user_name}" (not yet wired to DB).`);

  return {
    reply: `I've noted that user "${user_name}" should be removed. Once deleteUser() is implemented, I'll actually remove them. 🗑️`,
  };
}

async function handleModifyUser(nlu: NluResult): Promise<OrchestratorResponse> {
  const account_number = getEntity(nlu, "user_identifier");

  if (!account_number) {
    return {
      reply:
        "You asked me to modify a user, but I didn't catch which user. Please include their account number like 'reset the password for 123 456'.",
    };
  }

  // TODO: hook into your real password reset logic

  console.log(
    `🔧 [ADMIN] Requested password reset for user "${account_number}" (no real password handling yet).`
  );

  return {
    reply: `I've noted a password reset for user "${account_number}". Once user password storage is implemented, I'll actually reset it. 🔁`,
  };
}

async function handleChangeAdminPassword(nlu: NluResult): Promise<OrchestratorResponse> {
  const password = getEntity(nlu, "target_password");

  if (!password) {
    return {
      reply:
        "You asked me to change the admin password, but I didn't catch the new password. For now, please say something like 'change the password to myNewSecret123'.",
    };
  }

  await updateCliAdminPasswordHash(password);

  return {
    reply:
      "I've generated a new CLI admin password hash and printed it in the console. Please update your configuration/env with that hash and restart the CLI for it to take effect. 🔐",
  };
}

// ---- main handler object ----

export const userAccountControlHandler: IntentHandler = {
  canHandle(intentName: string): boolean {
    return (
      intentName === "create_user" ||
      intentName === "delete_user" ||
      intentName === "modify_user" ||
      intentName === "change_admin_password"
    );
  },

  async handle(
    nlu: NluResult,
    user: UserContext,
    _ctx: HandlerContext
  ): Promise<OrchestratorResponse> {
    // 1) Guard: only CLI admin can do this
    if (!isCliAdmin(user)) {
      return {
        reply:
          "Account control commands are only available from the CLI admin. I can't do that from this channel. 🔒",
      };
    }

    const intentName = nlu.intent?.name;

    switch (intentName) {
      case "create_user":
        return handleCreateUser(nlu);
      case "delete_user":
        return handleDeleteUser(nlu);
      case "modify_user":
        return handleModifyUser(nlu);
      case "change_admin_password":
        return handleChangeAdminPassword(nlu);
      default:
        return {
          reply:
            "I recognised this as an account-control command, but I'm not sure what exactly you wanted. 🤔",
        };
    }
  },
};
