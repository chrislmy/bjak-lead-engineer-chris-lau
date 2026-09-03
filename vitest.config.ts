import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["eval/assistant.eval.ts"],
    testTimeout: 180_000,
    hookTimeout: 180_000,
    fileParallelism: false,
    maxWorkers: 1,
    env: {
      DEEPEVAL_TELEMETRY_OPT_OUT: "1",
    },
  },
});
