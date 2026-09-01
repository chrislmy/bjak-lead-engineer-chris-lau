import path from "node:path";
import { ingestAll } from "./sources/index.ts";
import { rootDir } from "./sources/io.ts";
import { env } from "./env.ts";

const USAGE = `Personal work-experience assistant

Usage:
  npx tsx src/cli.ts ingest
  npx tsx src/cli.ts ask "<question>"
  npx tsx src/cli.ts eval

Commands:
  ingest   Rebuild knowledge/<source>/ section files and MANIFEST.md from fixtures
  ask      Answer a question from retrieved knowledge (not implemented yet)
  eval     Run the golden evaluation (not implemented yet)

Generator model: ${env.openaiModel}
Judge model:     ${env.judgeModel}
`;

const command = process.argv[2];

if (
  command === undefined ||
  command === "-h" ||
  command === "--help" ||
  command === "help"
) {
  process.stdout.write(USAGE);
  process.exit(0);
}

if (command === "ingest") {
  const written = await ingestAll();
  for (const out of written) {
    process.stdout.write(`Wrote ${path.relative(rootDir, out)}\n`);
  }
  process.exit(0);
}

if (command === "ask" || command === "eval") {
  process.stdout.write(USAGE);
  process.stderr.write(`Command "${command}" is stubbed until a later milestone.\n`);
  process.exit(0);
}

process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
process.exit(1);
