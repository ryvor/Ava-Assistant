import readline from "readline";
import bcrypt from "bcryptjs";
import { Orchestrator } from "../ctl/orchestrator/Orchestrator";
import { UserContext } from "../ctl/types/context";
import dotenv from "dotenv";

dotenv.config({ quiet: true });
const ADMIN_PASSWORD_HASH = process.env.CLI_HASH;

	// ----- helper: ask for hidden password -----
function promptHidden(question: string): Promise<string> {
	return new Promise((resolve) => {
		const stdin = process.stdin;
		const stdout = process.stdout;

		let input = "";

		stdout.write(question);

		if (stdin.isTTY) {
			stdin.setRawMode(true);
		}
		stdin.resume();

		const onData = (data: Buffer) => {
			const char = data.toString("utf8");

			if (char === "\r" || char === "\n") {
				stdout.write("\n");
				cleanup();
				return resolve(input);
			}

			if (char === "\u0003") {
				stdout.write("\n");
				cleanup();
				process.exit(1);
			}

			if (char === "\u0008" || char === "\u007f") {
				if (input.length > 0) {
					input = input.slice(0, -1);
					stdout.write("\b \b");
				}
				return;
			}

			if (char < " " || char > "~") {
				return;
			}

			input += char;
			stdout.write("*");
		};

		const cleanup = () => {
			stdin.removeListener("data", onData);
			if (stdin.isTTY) {
				stdin.setRawMode(false);
			}
			stdin.pause();
		};

		stdin.on("data", onData);
	});
}

// ----- require admin login before starting CLI -----
async function requireAdminLogin(): Promise<void> {
	if (!ADMIN_PASSWORD_HASH) {
		console.error("No admin password hash set. Set CLI_HASH or hardcode ADMIN_PASSWORD_HASH.");
		process.exit(1);
	}

	const maxAttempts = 3;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		const pw = await promptHidden("CLI admin password: ");
		const ok = await bcrypt.compare(pw, ADMIN_PASSWORD_HASH);

		if (ok) {
			console.log("Login successful.\n");
			return;
		}

		console.log("Incorrect password.\n");

		if (attempt === maxAttempts) {
			console.error("Too many failed attempts. Exiting.");
			process.exit(1);
		}
	}
}

// ----- normal Ava CLI loop -----
async function startCli() {
	const orchestrator = new Orchestrator();


	const user: UserContext = {
		account_number: 0,   // can stay a string
		displayName: "CLI Admin",
		channel: "cli",
		isAdmin: true,
	};

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	const promptLoop = () => {
		rl.question("> ", async (line) => {
			const text = line.trim();
			if (!text) {
				return promptLoop();
			}
			try {
				const res = await orchestrator.handleMessage(text, user);
				console.log("#:", res.reply ?? "[no reply]");
			} catch (err) {
				console.error("Error from Ava:", err);
			}

			promptLoop();
		});
	};

	promptLoop();
}

async function main() {
	await requireAdminLogin();
	await startCli();
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
