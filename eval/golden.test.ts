import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  BEHAVIOURS,
  CATEGORIES,
  contractText,
  goldens,
  isRefusal,
  type Behaviour,
  type Category,
} from "./golden.ts";

const fixtures = ["cv.md", "linkedin.md"]
  .map((name) =>
    readFileSync(fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url)), "utf8"),
  )
  .join("\n");

const byCategory = (category: Category) =>
  goldens.filter((golden) => golden.category === category);

describe("golden dataset", () => {
  it("has 22 cases with 8 / 3 / 4 / 3 / 4 categories", () => {
    assert.equal(goldens.length, 22);
    assert.equal(byCategory("direct").length, 8);
    assert.equal(byCategory("multi_source").length, 3);
    assert.equal(byCategory("ambiguous").length, 4);
    assert.equal(byCategory("unanswerable").length, 3);
    assert.equal(byCategory("adversarial").length, 4);
  });

  it("uses unique ids and known behaviour labels", () => {
    const ids = goldens.map((golden) => golden.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const golden of goldens) {
      assert.ok(CATEGORIES.includes(golden.category));
      assert.ok(BEHAVIOURS.includes(golden.behaviour));
      assert.ok(golden.question.length > 0);
    }
  });

  it("defines the refusal suite as behaviour === refuse", () => {
    const refusals = goldens.filter(isRefusal);
    assert.ok(refusals.length > 0);
    for (const golden of refusals) {
      assert.equal(golden.behaviour, "refuse");
    }
    const adversarial = byCategory("adversarial");
    assert.ok(adversarial.some((golden) => golden.behaviour !== "refuse"));
  });

  it("keeps round-up-metrics as adversarial + answer", () => {
    const golden = goldens.find((item) => item.id === "round-up-metrics");
    assert.ok(golden);
    assert.equal(golden.category, "adversarial");
    assert.equal(golden.behaviour, "answer");
    assert.equal(isRefusal(golden), false);
  });

  it("keeps mustContain as judge labels, not a substring lint", () => {
    assert.ok(fixtures.includes("ClickHouse"));
    assert.ok(goldens.some((golden) => golden.mustContain.length > 0));
  });

  it("keeps direct-answer required facts to the core claim", () => {
    const clickhouse = goldens.find((golden) => golden.id === "clickhouse-scale");
    assert.ok(clickhouse);
    assert.deepEqual(clickhouse.mustContain, ["Coda", "ClickHouse"]);
    const deliveroo = goldens.find((golden) => golden.id === "deliveroo-dispatch");
    assert.ok(deliveroo);
    assert.deepEqual(deliveroo.mustContain, ["order dispatch platform"]);
    const ocado = goldens.find((golden) => golden.id === "ocado-osp");
    assert.ok(ocado);
    assert.deepEqual(ocado.mustContain, ["Ocado Smart Platform"]);
  });

  it("does not ban mentioning CKA while refusing it", () => {
    const golden = goldens.find((item) => item.id === "kubernetes-cert");
    assert.ok(golden);
    assert.equal(golden.behaviour, "refuse");
    assert.ok(!golden.mustNotClaim.includes("CKA"));
  });

  it("builds a contract string for the later judge", () => {
    const conflict = goldens.find((golden) => golden.id === "coda-title");
    assert.ok(conflict);
    const text = contractText(conflict);
    assert.match(text, /Required behaviour: conflict/);
    assert.match(text, /Required facts \(paraphrase OK\):\n- Senior Software Engineer\n- Lead Software Engineer/);
    assert.match(text, /Banned assertions:\n\(none\)/);
  });

  it("uses (none) only when a list is empty", () => {
    const withClaims = goldens.find((golden) =>
      golden.mustNotClaim.some((item) => item.trim().length > 0),
    );
    assert.ok(withClaims);
    assert.doesNotMatch(contractText(withClaims), /Banned assertions:\n\(none\)/);
  });
});

describe("refusal suite", () => {
  it("includes refuse and conflict behaviours", () => {
    const behaviours: Behaviour[] = goldens.map((golden) => golden.behaviour);
    assert.ok(behaviours.includes("refuse"));
    assert.ok(behaviours.includes("conflict"));
  });
});
