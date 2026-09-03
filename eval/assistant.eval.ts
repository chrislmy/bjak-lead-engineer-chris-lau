import { expect, it } from "vitest";
import { LLMTestCase } from "deepeval/test-case";
import { ask, type AskResult } from "../src/assistant.ts";
import { retrieveAll } from "../src/sources/index.ts";
import {
  createLabelContract,
  createRefusalInjection,
  PASS_THRESHOLD,
} from "./geval.ts";
import { contractText, goldens, isRefusal, type Golden } from "./golden.ts";
import type { GEval } from "deepeval/metrics";

const answers = new Map<string, Promise<AskResult>>();
let knowledge: Promise<string[]> | undefined;

function actual(golden: Golden): Promise<AskResult> {
  let pending = answers.get(golden.id);
  if (!pending) {
    pending = ask(golden.question);
    answers.set(golden.id, pending);
  }
  return pending;
}

async function retrievalContext(): Promise<string[]> {
  knowledge ??= retrieveAll().then((docs) => [
    docs.map((doc) => `[${doc.source}]\n${doc.text}`).join("\n\n"),
  ]);
  return knowledge;
}

async function testCase(golden: Golden, result: AskResult): Promise<LLMTestCase> {
  return new LLMTestCase({
    input: golden.question,
    actualOutput: result.answer,
    retrievalContext: await retrievalContext(),
  });
}

async function score(
  metric: GEval,
  golden: Golden,
  result: AskResult,
): Promise<void> {
  await metric.measure(await testCase(golden, result));
  const value = metric.score ?? 0;
  const sources =
    result.citations.length > 0 ? result.citations.join(", ") : "(none)";
  process.stdout.write(
    [
      "",
      `=== ${metric.name} ${golden.id}  score=${value.toFixed(2)}  refused=${result.refused} ===`,
      `Q: ${golden.question}`,
      `A: ${result.answer}`,
      `Sources: ${sources}`,
      `Contract:\n${contractText(golden)}`,
      `Judge: ${metric.reason ?? "(none)"}`,
      "",
    ].join("\n"),
  );
  expect(
    value,
    `${metric.name} ${golden.id}: ${value} < ${PASS_THRESHOLD}. ${metric.reason ?? ""}`,
  ).toBeGreaterThanOrEqual(PASS_THRESHOLD);
}

it.each(goldens)("LabelContract $id", async (golden) => {
  const result = await actual(golden);
  await score(createLabelContract(golden), golden, result);
});

it.each(goldens.filter(isRefusal))("RefusalInjection $id", async (golden) => {
  const result = await actual(golden);
  await score(createRefusalInjection(golden), golden, result);
});
