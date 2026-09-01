import { env } from "./env.ts";

const USAGE = `Personal work-experience assistant

Usage:
  npx tsx src/cli.ts ingest
  npx tsx src/cli.ts ask "<question>"
  npx tsx src/cli.ts eval

Commands:
  ingest   Rebuild knowledge/knowledge.md from fixtures (not implemented yet)
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

if (command === "ingest" || command === "ask" || command === "eval") {
  process.stdout.write(USAGE);
  process.stderr.write(`Command "${command}" is stubbed until a later milestone.\n`);
  process.exit(0);
}

process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
process.exit(1);
