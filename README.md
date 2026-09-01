# Personal work-experience assistant

Take-home slice: a grounded assistant over committed knowledge sources.

`fixtures/cv.md` and `fixtures/linkedin.md` are **placeholders** (synthetic title conflict included). Replace them in place with real or redacted CV/LinkedIn text; keep the same ids in later goldens.

## Setup (under 10 minutes once Ollama is installed)

1. Install [Ollama](https://ollama.com), then pull the generator and judge:

   ```bash
   ollama pull llama3.2
   ollama pull llama3.1:8b
   ```

2. Copy environment defaults (no real secrets required for local Ollama). `.npmrc` uses the public npm registry.

   ```bash
   cp .env.example .env
   npm install
   ```

3. Print CLI usage:

   ```bash
   cp .env.example .env
   npm install
   ```

3. Print CLI usage:

   ```bash
   npx tsx src/cli.ts
   ```

Commands (ingest / ask / eval) are stubbed in this milestone. See `plan.md`.
