import OpenAI from "openai";
import { env } from "../env.ts";

const TIMEOUT_MS = 180_000;
const MAX_TOKENS = 4096;

export const FALLBACK_UNREACHABLE =
  "I couldn't reach the model, so I won't guess. Check that Ollama is running.";

export class ModelUnreachableError extends Error {
  constructor(cause?: unknown) {
    super(FALLBACK_UNREACHABLE);
    this.name = "ModelUnreachableError";
    this.cause = cause;
  }
}

export type ModelCompletion = {
  content: string;
  thinking: string;
};

export type CompleteOptions = {
  onThinking?: (chunk: string) => void;
};

export function createClient(): OpenAI {
  return new OpenAI({
    baseURL: env.openaiBaseUrl,
    apiKey: env.openaiApiKey,
    timeout: TIMEOUT_MS,
    maxRetries: 0,
  });
}

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function complete(
  messages: ChatMessage[],
  options: CompleteOptions = {},
): Promise<ModelCompletion> {
  try {
    const stream = await createClient().chat.completions.create({
      model: env.openaiModel,
      temperature: 0,
      max_tokens: MAX_TOKENS,
      messages,
      stream: true,
    });
    let content = "";
    let thinking = "";
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      const text = delta?.content;
      if (typeof text === "string" && text.length > 0) {
        content += text;
      }
      const thinkPiece = extraString(delta, [
        "reasoning",
        "reasoning_content",
        "thinking",
      ]);
      if (thinkPiece.length > 0) {
        thinking += thinkPiece;
        options.onThinking?.(thinkPiece);
      }
    }
    content = content.trim();
    thinking = thinking.trim();
    if (content.length === 0 && thinking.length === 0) {
      throw new ModelUnreachableError();
    }
    return { content, thinking };
  } catch (error) {
    if (error instanceof ModelUnreachableError) {
      throw error;
    }
    throw new ModelUnreachableError(error);
  }
}

function extraString(value: unknown, keys: string[]): string {
  if (value === null || typeof value !== "object") {
    return "";
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const field = record[key];
    if (typeof field === "string" && field.length > 0) {
      return field;
    }
  }
  return "";
}
