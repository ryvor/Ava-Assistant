import { getAvaReply } from '../model/decisionEngine.js';

async function main() {
	const raw = await getAvaReply("I'm starving and really fancy a pizza.", '');
	console.log('RAW FROM MODEL:', raw);
}

main().catch(err => {
	console.error('Error:', err);
	process.exit(1);
});