import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const modelsDir = path.join(rootDir, "models");
const dataDir = path.join(rootDir, "data");

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
		console.log(`✓ ${spec.id} already exists at ${targetPath}`);
		return;
	}

	const downloadUrl = buildDownloadUrl(spec.link, spec.path);
	console.log(`↓ Downloading ${spec.id} from ${downloadUrl}`);

	const response = await fetch(downloadUrl);
	if (!response.ok || !response.body) {
		throw new Error(`Failed to download ${spec.id}: ${response.status} ${response.statusText}`);
	}

	await ensureDir(path.dirname(targetPath));
	const fileStream = fs.createWriteStream(targetPath);
	await pipeline(response.body, fileStream);
	console.log(`✓ Saved ${spec.id} to ${targetPath}`);
}

async function main() {
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
	console.log(`✓ Ensured data directory at ${dataDir}`);
}

main().catch((err) => {
	console.error("Init failed:", err);
	process.exitCode = 1;
});
