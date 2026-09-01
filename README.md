# Personal work-experience assistant

Take-home slice: a grounded assistant over committed knowledge sources.

`fixtures/cv.md` is the real CV with synthetic contact details (`example.com` / dummy phone). `fixtures/linkedin.md` is still a **placeholder** with a synthetic title conflict. Keep the same source ids in later goldens.

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

3. Print CLI usage, then ingest fixtures into `knowledge/<source>/` (one markdown file per `##` section, YAML frontmatter) and `knowledge/MANIFEST.md`:

   ```bash
   npx tsx src/cli.ts
   npx tsx src/cli.ts ingest
   ```

`knowledge/SOURCES.md` describes the fixtures. `ask` and `eval` are stubbed. A new knowledge source is a module in `src/sources/`, one extra array entry, a fixture, then ingest. See `plan.md`.
