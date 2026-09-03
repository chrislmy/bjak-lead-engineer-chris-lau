import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ask } from "../src/assistant.ts";
import { env } from "../src/env.ts";
import { goldens } from "./golden.ts";

const model = env.openaiModel;
console.log(`generator=${model}`);

const rows: Array<{ id: string; ms: number; refused: boolean }> = [];

for (const golden of goldens) {
  const result = await ask(golden.question);
  rows.push({ id: golden.id, ms: result.elapsedMs, refused: result.refused });
  console.log(`${golden.id}\t${result.elapsedMs}\trefused=${result.refused}`);
}

const sorted = [...rows].sort((a, b) => a.ms - b.ms);
const percentile = (p: number) => {
  if (sorted.length === 0) {
    return 0;
  }
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, rank)]?.ms ?? 0;
};
const mean = Math.round(rows.reduce((sum, row) => sum + row.ms, 0) / rows.length);

const report = `# Ask latency

Measured ${new Date().toISOString().slice(0, 16)}Z. Generator \`${model}\` (from \`OPENAI_MODEL\` / \`.env\`). \`elapsedMs\` is the model call only (same clock as \`thought for\`). n=${rows.length} golden questions, sequential, cold-ish (no extra warmup).

| Stat | Value |
| --- | --- |
| n | ${rows.length} |
| min | ${(sorted[0]?.ms ?? 0) / 1000}s |
| p50 | ${percentile(50) / 1000}s |
| p95 | ${percentile(95) / 1000}s |
| max | ${(sorted[sorted.length - 1]?.ms ?? 0) / 1000}s |
| mean | ${mean / 1000}s |

| Case | ms |
| --- | --- |
${sorted.map((row) => `| ${row.id} | ${row.ms} |`).join("\n")}
`;

const out = fileURLToPath(new URL("./results/latency.md", import.meta.url));
writeFileSync(out, report);
console.log(`\nwrote ${out}`);
console.log(`model=${model} p50=${percentile(50)}ms p95=${percentile(95)}ms mean=${mean}ms`);
