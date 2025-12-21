import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const modelsDir = path.join(rootDir, "models");
const dataDir = path.join(rootDir, "data");
const envFilePath = path.join(rootDir, ".env");
const envExamplePath = path.join(rootDir, ".env.example");

async function ensureDir(dirPath) {
	await fs.promises.mkdir(dirPath, { recursive: true });
}

function buildDownloadUrl(link, modelPath) {
	const base = new URL(link);
	if (base.host.includes("huggingface.co")) {
		let resolvedPath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
		resolvedPath += `resolve/main/${modelPath}`;
		base.pathname = resolvedPath;
		base.searchParams.set("download", "true");
		return base.toString();
	}
	return link;
}

async function readSpecs() {
	if (process.env.AVA_MODELS_JSON && process.env.AVA_MODELS_JSON.trim()) {
		return JSON.parse(process.env.AVA_MODELS_JSON);
	}
	const jsonPath = path.join(rootDir, "models.json");
	const raw = await fs.promises.readFile(jsonPath, "utf-8");
	return JSON.parse(raw);
}

async function downloadModel(spec) {
	const targetPath = path.join(modelsDir, spec.path);
	if (fs.existsSync(targetPath)) {
		console.log(`[Ava Initialization] ${spec.id} already exists at ${targetPath}`);
		return;
	}

	const downloadUrl = buildDownloadUrl(spec.link, spec.path);
	console.log(`[Ava Initialization] Downloading ${spec.id} from ${downloadUrl}`);

	const response = await fetch(downloadUrl);
	if (!response.ok || !response.body) {
		throw new Error(`Failed to download ${spec.id}: ${response.status} ${response.statusText}`);
	}

	await ensureDir(path.dirname(targetPath));
	const fileStream = fs.createWriteStream(targetPath);
	await pipeline(response.body, fileStream);
	console.log(`[Ava Initialization] Saved ${spec.id} to ${targetPath}`);
}

function runCommand(cmd, args, options = {}) {
	return new Promise((resolve, reject) => {
		const spawnOptions = { stdio: "inherit", ...options };
		if (spawnOptions.shell === undefined && process.platform === "win32" && cmd.endsWith(".cmd")) {
			spawnOptions.shell = true;
		}

		const child = spawn(cmd, args, spawnOptions);
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
			} else {
				reject(new Error(`${cmd} exited with code ${code}`));
			}
		});
	});
}

function resolveNpmInstallInvocation() {
	const npmExecPath = process.env.npm_execpath;
	if (npmExecPath && fs.existsSync(npmExecPath)) {
		return {
			command: process.execPath,
			args: [npmExecPath, "install"],
			options: { cwd: rootDir },
		};
	}

	const isWindows = process.platform === "win32";
	return {
		command: "npm",
		args: ["install"],
		options: { cwd: rootDir, shell: isWindows },
	};
}

async function ensureNodeModules() {
	const nodeModulesPath = path.join(rootDir, "node_modules");
	let needsInstall = true;

	try {
		const stats = await fs.promises.stat(nodeModulesPath);
		if (stats.isDirectory()) {
			const entries = await fs.promises.readdir(nodeModulesPath);
			needsInstall = entries.length === 0;
		}
	} catch (error) {
		if (error.code !== "ENOENT") {
			throw error;
		}
	}

	if (!needsInstall) {
		console.log(`[Ava Initialization] Node modules already installed`);
		return;
	}

	console.log(`[Ava Initialization] Installing node modules (npm install)`);
	const npmInvocation = resolveNpmInstallInvocation();
	await runCommand(npmInvocation.command, npmInvocation.args, npmInvocation.options);
	console.log(`[Ava Initialization] Finished installing node modules`);
}


async function ensureEnvFile() {
	try {
		await fs.promises.access(envFilePath, fs.constants.F_OK);
		return;
	} catch {
		// missing file, copy example next
	}

	try {
		await fs.promises.copyFile(envExamplePath, envFilePath, fs.constants.COPYFILE_EXCL);
		console.log(`[Ava Initialization] Created .env from .env.example`);
	} catch (error) {
		if (error.code === "EEXIST") return;
		if (error.code === "ENOENT") {
			console.warn("No .env.example found to copy from");
			return;
		}
		throw error;
	}
}

async function main() {
	await ensureNodeModules();
	await ensureDir(modelsDir);
	const specs = await readSpecs();

	for (const spec of specs) {
		if (!spec?.id || !spec?.path || !spec?.link) {
			console.warn("Skipping invalid model spec", spec);
			continue;
		}
		await downloadModel(spec);
	}

	await ensureDir(dataDir);
	await ensureEnvFile();
	console.log(`[Ava Initialization] Ensured data directory at ${dataDir}`);
}

main().catch((err) => {
	console.error("Init failed:", err);
	process.exitCode = 1;
});
