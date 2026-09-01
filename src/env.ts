import { config as loadEnv } from "dotenv";

loadEnv();

function read(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.length > 0 ? value : fallback;
}

export const env = {
  openaiBaseUrl: read("OPENAI_BASE_URL", "http://localhost:11434/v1"),
  openaiApiKey: read("OPENAI_API_KEY", "ollama"),
  openaiModel: read("OPENAI_MODEL", "qwen3:4b"),
  judgeModel: read("JUDGE_MODEL", "llama3.1:8b"),
  ollamaHost: read("OLLAMA_HOST", "http://localhost:11434"),
  showThinking: readFlag("ASK_SHOW_THINKING"),
};

function readFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}
