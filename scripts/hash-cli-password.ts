// scripts/hash-cli-password.ts
import bcrypt from "bcryptjs";

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.error("Usage: ts-node scripts/hash-cli-password.ts <password>");
    process.exit(1);
  }

  const hash = await bcrypt.hash(password, 10);
  console.log("Store this hash in your config or env as CLI_HASH:");
  console.log(hash);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
