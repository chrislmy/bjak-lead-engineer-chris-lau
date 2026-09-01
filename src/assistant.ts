import { complete, FALLBACK_UNREACHABLE, ModelUnreachableError } from "./llm/client.ts";
import { retrieveAll, type RetrievedSource } from "./sources/index.ts";

export const FALLBACK_NO_KNOWLEDGE =
  "No knowledge loaded. Run `npx tsx src/cli.ts ingest` first. I won't guess from an empty context.";

// Grounding rules live here so the HTTP client stays a thin transport.
// Keep this short: extra edge-cases make qwen3:4b spend its budget thinking.
const SYSTEM = `You are a personal assistant for this person's professional background. Answer from the tagged knowledge only.

Do not invent qualifications, employers, projects, or achievements.
If sources disagree, report both and name the sources.
If the knowledge does not cover the question, say so and set refused to true.

JSON only: {"answer": string, "citations": string[], "refused": boolean}`;

export type ParsedAnswer = {
  answer: string;
  citations: string[];
  refused: boolean;
};

export type AskResult = ParsedAnswer & {
  thinking: string;
  elapsedMs: number;
};

export function formatThoughtDuration(elapsedMs: number): string {
  if (elapsedMs < 1000) {
    return `thought for ${Math.max(0, Math.round(elapsedMs))}ms`;
  }
  const seconds = elapsedMs / 1000;
  const label = elapsedMs % 1000 === 0 ? `${seconds.toFixed(0)}s` : `${seconds.toFixed(1)}s`;
  return `thought for ${label}`;
}

function emptyResult(
  answer: string,
  extra: { thinking?: string; elapsedMs?: number } = {},
): AskResult {
  return {
    answer,
    citations: [],
    refused: true,
    thinking: extra.thinking ?? "",
    elapsedMs: extra.elapsedMs ?? 0,
  };
}

export async function ask(
  question: string,
  options: { onThinking?: (chunk: string) => void } = {},
): Promise<AskResult> {
  const docs = await retrieveAll();
  if (docs.length === 0) {
    return emptyResult(FALLBACK_NO_KNOWLEDGE);
  }
  const retrievedIds = docs.map((doc) => doc.source);
  const started = Date.now();
  try {
    const completion = await complete(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: formatUserMessage(docs, question) },
      ],
      { onThinking: options.onThinking },
    );
    const split = splitThink(completion.content);
    const thinking = joinThinking(completion.thinking, split.thinking);
    const elapsedMs = Date.now() - started;
    if (split.body.length === 0) {
      return emptyResult(FALLBACK_UNREACHABLE, { thinking, elapsedMs });
    }
    return {
      ...parseModelJson(split.body, retrievedIds),
      thinking,
      elapsedMs,
    };
  } catch (error) {
    if (error instanceof ModelUnreachableError) {
      return emptyResult(error.message, { elapsedMs: Date.now() - started });
    }
    throw error;
  }
}

export function formatUserMessage(
  docs: RetrievedSource[],
  question: string,
): string {
  const blocks = docs.map(
    (doc) => `<source id="${doc.source}">\n${doc.text.trimEnd()}\n</source>`,
  );
  return `${blocks.join("\n\n")}

Question: ${question}`;
}

export function parseModelJson(
  raw: string,
  retrievedIds: string[],
): ParsedAnswer {
  const allowed = new Set(retrievedIds);
  const trimmed = splitThink(raw).body;
  const parsed = extractJson(trimmed);
  if (parsed !== undefined) {
    const answer = answerText(parsed);
    if (answer !== undefined) {
      const citations = filterCitations(parsed.citations, allowed);
      const refused = Boolean(parsed.refused);
      return {
        answer,
        citations:
          refused ? [] : citations.length > 0 ? citations : [...retrievedIds],
        refused,
      };
    }
    return {
      answer: "The model omitted the answer field.",
      citations: [],
      refused: true,
    };
  }
  return {
    answer: trimmed,
    citations: [...retrievedIds],
    refused: false,
  };
}

export function splitThink(text: string): { body: string; thinking: string } {
  const chunks: string[] = [];
  const body = text
    .replace(/<think\b[^>]*>([\s\S]*?)<\/think>/gi, (_match, inner: string) => {
      const piece = inner.trim();
      if (piece.length > 0) {
        chunks.push(piece);
      }
      return "";
    })
    .replace(/<think\b[^>]*>([\s\S]*)$/i, (_match, inner: string) => {
      const piece = inner.trim();
      if (piece.length > 0) {
        chunks.push(piece);
      }
      return "";
    })
    .trim();
  return { body, thinking: chunks.join("\n\n") };
}

function joinThinking(...parts: string[]): string {
  return parts.filter((part) => part.trim().length > 0).join("\n\n");
}

type ModelObject = Record<string, unknown>;

function answerText(parsed: ModelObject): string | undefined {
  for (const key of ["answer", "response", "text", "content"]) {
    const value = parsed[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function extractJson(text: string): ModelObject | undefined {
  const unfenced = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  const object = parseObject(unfenced);
  if (object !== undefined) {
    return object;
  }
  const start = unfenced.indexOf("{");
  const end = unfenced.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return parseObject(unfenced.slice(start, end + 1));
  }
  return undefined;
}

function parseObject(text: string): ModelObject | undefined {
  try {
    const value: unknown = JSON.parse(text);
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return value as ModelObject;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function filterCitations(value: unknown, allowed: Set<string>): string[] {
  const items = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/).filter((part) => part.length > 0)
      : [];
  const out: string[] = [];
  for (const item of items) {
    if (typeof item !== "string") {
      continue;
    }
    const id = item.trim();
    if (allowed.has(id) && !out.includes(id)) {
      out.push(id);
    }
  }
  return out;
}
