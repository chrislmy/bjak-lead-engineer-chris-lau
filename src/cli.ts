import { spawnSync } from "node:child_process";
import path from "node:path";
import { ask, formatThoughtDuration } from "./assistant.ts";
import { ingestAll } from "./sources/index.ts";
import { rootDir } from "./sources/io.ts";
import { env } from "./env.ts";

const USAGE = `Personal work-experience assistant

Usage:
  npm run ingest
  npm run ask -- "<question>"
  npm run ask -- --think "<question>"
  npm run eval

Commands:
  ingest   Rebuild knowledge/<source>/ section files and MANIFEST.md from fixtures
  ask      Answer a question from retrieved knowledge
           --think   print model reasoning on stderr
  eval     Score goldens with DeepEval GEval (LabelContract + RefusalInjection)

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

if (command === "ask") {
  const args = process.argv.slice(3);
  const showThinking = args.includes("--think") || env.showThinking;
  const question = args.filter((arg) => arg !== "--think").join(" ").trim();
  if (question.length === 0) {
    process.stderr.write(
      `Usage: npm run ask -- [--think] "<question>"\n`,
    );
    process.exit(1);
  }
  let streamedThinking = false;
  if (showThinking) {
    process.stderr.write("Thinking:\n");
  }
  const result = await ask(question, {
    onThinking: showThinking
      ? (chunk) => {
          streamedThinking = true;
          process.stderr.write(chunk);
        }
      : undefined,
  });
  if (showThinking) {
    if (!streamedThinking) {
      const trace =
        result.thinking.length > 0
          ? result.thinking
          : "(none — no reasoning field or <think> block)";
      process.stderr.write(trace);
    }
    process.stderr.write("\n\n");
  }
  const sources =
    result.citations.length > 0 ? result.citations.join(", ") : "(none)";
  process.stdout.write(
    `${result.answer}\n\nSources: ${sources}\n${formatThoughtDuration(result.elapsedMs)}\n`,
  );
  process.exit(0);
}

if (command === "eval") {
  const result = spawnSync(
    "npx",
    ["vitest", "run", "eval/assistant.eval.ts"],
    {
      cwd: rootDir,
      stdio: "inherit",
      env: { ...process.env, DEEPEVAL_TELEMETRY_OPT_OUT: "1" },
    },
  );
  process.exit(result.status === null ? 1 : result.status);
}

process.stderr.write(`Unknown command: ${command}\n\n${USAGE}`);
process.exit(1);
