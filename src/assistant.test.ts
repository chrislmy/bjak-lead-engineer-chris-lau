import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatThoughtDuration,
  formatUserMessage,
  parseModelJson,
  splitThink,
  SYSTEM,
} from "./assistant.ts";

const ids = ["cv", "linkedin"];

describe("parseModelJson", () => {
  it("reads a clean JSON object", () => {
    const result = parseModelJson(
      '{"answer":"ClickHouse at Coda.","citations":["cv"],"refused":false}',
      ids,
    );
    assert.deepEqual(result, {
      answer: "ClickHouse at Coda.",
      citations: ["cv"],
      refused: false,
    });
  });

  it("strips markdown fences", () => {
    const result = parseModelJson(
      '```json\n{"answer":"ok","citations":["linkedin"],"refused":false}\n```',
      ids,
    );
    assert.equal(result.answer, "ok");
    assert.deepEqual(result.citations, ["linkedin"]);
  });

  it("extracts JSON buried in prose", () => {
    const result = parseModelJson(
      'Sure.\n{"answer":"both titles","citations":["cv","linkedin"],"refused":false}\n',
      ids,
    );
    assert.equal(result.answer, "both titles");
    assert.deepEqual(result.citations, ["cv", "linkedin"]);
  });

  it("drops citations that were not retrieved", () => {
    const result = parseModelJson(
      '{"answer":"x","citations":["cv","web"],"refused":false}',
      ids,
    );
    assert.deepEqual(result.citations, ["cv"]);
  });

  it("accepts a comma-separated citations string", () => {
    const result = parseModelJson(
      '{"answer":"x","citations":"cv, linkedin","refused":false}',
      ids,
    );
    assert.deepEqual(result.citations, ["cv", "linkedin"]);
  });

  it("fills retrieved ids when the model answers but omits citations", () => {
    const result = parseModelJson(
      '{"answer":"x","citations":[],"refused":false}',
      ids,
    );
    assert.deepEqual(result.citations, ids);
  });

  it("keeps citations empty on a refusal", () => {
    const result = parseModelJson(
      '{"answer":"I don\'t know.","citations":[],"refused":true}',
      ids,
    );
    assert.equal(result.refused, true);
    assert.deepEqual(result.citations, []);
  });

  it("drops citations when the model refuses", () => {
    const result = parseModelJson(
      '{"answer":"The sources do not cover that.","citations":["cv"],"refused":true}',
      ids,
    );
    assert.equal(result.refused, true);
    assert.deepEqual(result.citations, []);
  });

  it("strips qwen think tags before parsing JSON", () => {
    const result = parseModelJson(
      '<think>plan</think>\n{"answer":"ClickHouse","citations":["cv"],"refused":false}',
      ids,
    );
    assert.equal(result.answer, "ClickHouse");
    assert.deepEqual(result.citations, ["cv"]);
  });

  it("uses the raw text when JSON is missing", () => {
    const result = parseModelJson("not json at all", ids);
    assert.deepEqual(result, {
      answer: "not json at all",
      citations: ids,
      refused: false,
    });
  });

  it("does not echo JSON that omitted answer", () => {
    const result = parseModelJson(
      '{"citations":["cv","linkedin"],"refused":false}',
      ids,
    );
    assert.equal(result.refused, true);
    assert.equal(result.citations.length, 0);
    assert.doesNotMatch(result.answer, /citations/);
  });

  it("accepts response as an answer alias", () => {
    const result = parseModelJson(
      '{"response":"ClickHouse cluster","citations":["cv"],"refused":false}',
      ids,
    );
    assert.equal(result.answer, "ClickHouse cluster");
    assert.deepEqual(result.citations, ["cv"]);
  });
});

describe("SYSTEM", () => {
  it("tells the model not to drop a shorter source", () => {
    assert.match(SYSTEM, /every tagged source whose text supports the answer/i);
    assert.match(SYSTEM, /A shorter source still counts/i);
  });
});

describe("formatUserMessage", () => {
  it("is just tagged sources and the question", () => {
    const message = formatUserMessage(
      [
        { source: "cv", text: "Senior Software Engineer" },
        { source: "linkedin", text: "Lead Software Engineer" },
      ],
      "What is their title?",
    );
    assert.match(message, /<source id="cv">\nSenior Software Engineer\n<\/source>/);
    assert.match(
      message,
      /<source id="linkedin">\nLead Software Engineer\n<\/source>/,
    );
    assert.match(message, /Question: What is their title\?$/);
    assert.doesNotMatch(message, /Third person|one sentence per|JSON only/i);
  });
});

describe("formatThoughtDuration", () => {
  it("uses milliseconds under one second", () => {
    assert.equal(formatThoughtDuration(0), "thought for 0ms");
    assert.equal(formatThoughtDuration(850), "thought for 850ms");
  });

  it("uses seconds from one second up", () => {
    assert.equal(formatThoughtDuration(1000), "thought for 1s");
    assert.equal(formatThoughtDuration(14917), "thought for 14.9s");
    assert.equal(formatThoughtDuration(15000), "thought for 15s");
  });
});

describe("splitThink", () => {
  it("pulls closed think tags out of the body", () => {
    assert.deepEqual(
      splitThink('<think>plan the json</think>\n{"answer":"ok"}'),
      { body: '{"answer":"ok"}', thinking: "plan the json" },
    );
  });
});
