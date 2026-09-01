import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retrieveAll } from "./index.ts";

describe("retrieveAll", () => {
  it("loads both full sources and does not take a query", async () => {
    assert.equal(retrieveAll.length, 0);
    const docs = await retrieveAll();
    assert.deepEqual(
      docs.map((doc) => doc.source).sort(),
      ["cv", "linkedin"],
    );
    const cv = docs.find((doc) => doc.source === "cv");
    const linkedin = docs.find((doc) => doc.source === "linkedin");
    assert.ok(cv);
    assert.ok(linkedin);
    assert.match(cv.text, /ClickHouse/);
    assert.match(cv.text, /300M/);
    assert.match(linkedin.text, /Lead Software Engineer/);
    assert.match(linkedin.text, /experimentation analytics/);
  });
});
