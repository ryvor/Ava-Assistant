// web/server.ts
import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { handleWebMessage, AvaRequest, userValidation, newSession, confirmSession } from "../ctl/orchestrator/webEntry";
import { revokeSession } from "../ctl/store/sessionStore";
import { getUser } from "../ctl/store/userStore";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

dotenv.config({ quiet: true });
const SKIP_LOGIN = false;

// If you want TS help on req.body:
interface MessageBody {
  message?: string;
  account_number?: string;
}

const app = express();                                                  // Create the app
const PORT = process.env.WEB_PORT;                                      // Find the specified port from the applications enviroment
app.use(cookieParser());                                                // Alow the app to use the Cookie Parser
app.use(express.json());                                                // Parse JSON bodies (needed for req.body)
app.use(express.static(path.join(__dirname, "public")));                // Serve static files from /web/public
app.use("/phosphor", express.static( path.join(__dirname, "..", "node_modules", "@phosphor-icons", "web"))); // Serve Phosphor icons (from node_modules


// Root -> index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// User login and authentication 
app.post("/api/auth/login", async (req, res) => {
  const { account_number, challenge_id, answer } = req.body as {
    account_number?: string;
    challenge_id?: string;
    answer?: string;
  };

  try {
    // PHASE 1: start login, user entered 6-digit account number
    if (account_number && !challenge_id && !answer) {
      return startLoginWithAccountNumber(account_number, req, res);
    }

    // PHASE 2: verify challenge answer
    if (challenge_id && answer) {
      return verifyLoginChallenge(challenge_id, answer, req, res);
    }

    // Anything else is malformed
    return res.status(400).json({
      status: "error",
      error: "INVALID_PAYLOAD",
    });
  } catch (err) {
    console.error("Error in /api/auth/login:", err);
    return res.status(500).json({
      status: "error",
      error: "INTERNAL_ERROR",
    });
  }
});

// User login and authentication 
app.post("/api/auth/verifyPin", async (req, res) => {
  const { account_number, pin } = req.body as {
    account_number: string;
    pin: string;
  };

  var accountNumber = Number(account_number);
  const user = userValidation(accountNumber);
  if (!user) {
    return res.status(404).json({
      status: "error",
      error: "ACCOUNT_NOT_FOUND",
    });
  }

  if(await bcrypt.compare(pin, user.one_time_pin_hash)) {
    // after login success
    const token = randomBytes(32).toString("hex");
    res.cookie("ava_session_token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: 1000 * 60 * 60 * 12,
    });
    newSession(accountNumber, token);
    return res.json({
      status: "SUCCESS",
      userId: account_number,
      displayName: user.display_name,
    });
  } else {
    return res.json({
      status: "error",
      userId: account_number,
      displayName: user.display_name,
    });
  }
});

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, account_number } = req.body as { message?: string, account_number: number };

    if (account_number < 1) return res.status(401).json({ status: "error", error: "User account is incorrectly set." });
    if (!message || !message.trim()) return res.status(400).json({ status: "error", error: "message is required" });
    if (!account_number && !SKIP_LOGIN) return res.status(401).json({ status: "error", error: "Not logged in" });

    const avaReq: AvaRequest = {
      account_number,
      message: message.trim(),
    };

    const avaReply = await handleWebMessage(avaReq);
    res.json(avaReply);
  } catch (err) {
    console.error("Error in /api/chat:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get currently logged in user data
app.post("/api/getUser", async (req, res) => {
  const token = req.cookies.ava_session_token;
  if (!token) return res.status(401).json({ status: "error", error: "User account is required" });

  const session = await confirmSession(token);
  if (!session) return res.status(401).json({ status: "error", error: "Session is inactive" });

  const user = getUser(session.account_number);
  if (!user) return res.status(404).json({ status: "error", error: "User not found" });

  console.log("Token: ", token, " is valid for user ", session.account_number);
  
  return res.status(200).json({ user: session.account_number, displayName: user.display_name });
});

app.post("/api/logout", async (req, res) => {
  const token = req.cookies?.ava_session_token;
  if (token) {
    revokeSession(token);
    res.clearCookie("ava_session_token", {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
    });
  }
  return res.status(200).json({ status: "SUCCESS" });
});


// Run the server and print to console a log
app.listen(PORT, () => {
  console.log(`Ava Web dev server running at http://localhost:${PORT}`);
});


/*
 *  HELPERS
 */


// In-memory stub for now:
const fakeUsers = new Map<string, { id: string; displayName: string }>([
  ["123456", { id: "u_1", displayName: "Test User" }],
]);

// In-memory challenge store (stub)
const loginChallenges = new Map<string, { userId: string; correctAnswer: string }>();

function createChallengeId() {
  return "ch_" + Math.random().toString(36).slice(2, 10);
}

async function startLoginWithAccountNumber( account_number: string, req: express.Request, res: express.Response ) {
  // Basic validation
  if (!/^\d{6}$/.test(account_number)) {
    return res.status(400).json({
      status: "error",
      error: "INVALID_ACCOUNT_NUMBER",
    });
  }

  // Look up user (replace with SQLite query later)
  //const user = fakeUsers.get(account_number);
  const user = userValidation(Number(account_number));
  if (!user) {
    return res.status(404).json({
      status: "error",
      error: "ACCOUNT_NOT_FOUND",
    });
  }
  var challengeId = createChallengeId()

  var response: {
    account: string;
    status: string;
    security_type: string;
    displayName: string;
    question?: string;
    correctAnswer?: string;
    challengeId?: string;
  } = {
    account: account_number,
    status: "challenge_required",
    security_type: user.security_type,
    displayName: user.display_name,
  };

  if(user.security_type == "PIN") {

    loginChallenges.set(challengeId, {
      userId: account_number,
      correctAnswer: user.one_time_pin_hash,
    });

    return res.json(response);
  } else {
    // Build a simple challenge.
    // Later, you'll generate this from Ava's conversation memory.
    var correctAnswer = "Pizza"; // hard-coded for now
    response.question = "What was the last order you made? Pizza, taxi to the airport or Chinese?";
    response.correctAnswer = correctAnswer; // hard-coded for now
    response.challengeId = challengeId;

    loginChallenges.set(challengeId, {
      userId: account_number,
      correctAnswer,
    });

    return res.json(response);
  }
}

async function verifyLoginChallenge(
  challengeId: string,
  answer: string,
  req: express.Request,
  res: express.Response
) {
  const challenge = loginChallenges.get(challengeId);

  if (!challenge) {
    return res.status(400).json({
      status: "error",
      error: "CHALLENGE_NOT_FOUND",
    });
  }

  const isCorrect =
    answer.trim().toLowerCase() ===
    challenge.correctAnswer.trim().toLowerCase();

  if (!isCorrect) {
    return res.status(401).json({
      status: "error",
      error: "WRONG_ANSWER",
    });
  }

  // ✅ Authenticated: issue session here (cookie, token, etc.)
  // For now, just return success payload
  loginChallenges.delete(challengeId);

  const user = [...fakeUsers.values()].find(
    (u) => u.id === challenge.userId
  );

  return res.json({
    status: "verified",
    userId: challenge.userId,
    displayName: user?.displayName ?? "User",
  });
}
