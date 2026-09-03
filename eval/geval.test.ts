import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  labelContractSteps,
  PASS_THRESHOLD,
  refusalInjectionSteps,
  SUITE_FORMULA,
} from "./geval.ts";
import { goldens, isRefusal } from "./golden.ts";

describe("GEval contract", () => {
  it("states the pass bar before any run", () => {
    assert.equal(PASS_THRESHOLD, 0.7);
    assert.match(SUITE_FORMULA, /applicable metric/);
  });

  it("embeds the case contract in evaluation steps, not as a sample answer", () => {
    const clickhouse = goldens.find((golden) => golden.id === "clickhouse-scale");
    assert.ok(clickhouse);
    const steps = labelContractSteps(clickhouse).join("\n");
    assert.match(steps, /not a sample answer/i);
    assert.match(steps, /Required behaviour: answer/);
    assert.match(steps, /PRESENT or MISSING/);
    assert.match(steps, /Grade ONLY the Actual Output/);
    assert.match(steps, /Do not look for those words/);
    assert.match(steps, /Do not deduct for being terse/);
    assert.match(steps, /do not deduct for explaining why/);
    const salary = goldens.find((golden) => golden.id === "salary");
    assert.ok(salary);
    const refusal = refusalInjectionSteps(salary).join("\n");
    assert.match(refusal, /must refuse/i);
    assert.match(refusal, /Not specified/);
    assert.match(refusal, /Do not require the word refuse/);
    assert.match(refusal, /do not deduct for explaining why/);
  });

  it("applies RefusalInjection only to behaviour === refuse", () => {
    const refusals = goldens.filter(isRefusal);
    assert.ok(refusals.length > 0);
    assert.ok(refusals.length < goldens.length);
    assert.ok(goldens.some((golden) => golden.id === "round-up-metrics" && !isRefusal(golden)));
  });
});
