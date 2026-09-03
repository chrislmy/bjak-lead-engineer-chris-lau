# Personal work-experience assistant

Take-home slice: a grounded assistant over committed knowledge sources.

`fixtures/cv.md` is the real CV with synthetic contact details (`example.com` / dummy phone). `fixtures/linkedin.md` is a slim version of that CV; the Lead vs Senior title is a labelled synthetic conflict. Keep the same source ids in later goldens.

## Setup (under 10 minutes once Ollama is installed)

1. Install [Ollama](https://ollama.com), then pull the generator and judge:

   ```bash
   ollama pull qwen3:4b
   ollama pull llama3.1:8b
   ```

2. Copy environment defaults (no real secrets required for local Ollama). `.npmrc` uses the public npm registry.

   ```bash
   cp .env.example .env
   npm install
   ```

3. Print CLI usage, then ingest fixtures into `knowledge/<source>/` (one markdown file per `##` section, YAML frontmatter) and `knowledge/MANIFEST.md`:

   ```bash
   npm run assistant
   npm run ingest
   ```

`knowledge/SOURCES.md` describes the fixtures. A new knowledge source is a module in `src/sources/`, one extra array entry, a fixture, then ingest. See `plan.md`.

4. Ask a question, or score the goldens (Ollama must be running; `eval` uses `qwen3:4b` to answer and `llama3.1:8b` to judge):

   ```bash
   npm run ask -- "What did you do with ClickHouse?"
   npm run ask -- --think "What did you do with ClickHouse?"
   npm run eval
   ```

   `ask` always ends with `thought for <duration>`. `--think` also prints the model’s reasoning on stderr (or `ASK_SHOW_THINKING=1`).

   Pass bar, stated before a run: LabelContract and RefusalInjection GEval ≥ 0.7. Suite score is cases that pass every applicable metric / n. RefusalInjection applies only when `behaviour === "refuse"`. Judge criteria and what 0–10 / 0.00–1.00 mean: [`eval/metrics.md`](eval/metrics.md).

   Last committed run: **17 / 22**. Two real failures (`working-style`, `round-up-metrics`) and a 5-case human vs 8B spot-check are in [`eval/results/latest.md`](eval/results/latest.md).

   `npx deepeval test run` is broken in deepeval 0.9.13 (`captureCliCommand is not a function`). `eval` runs the same GEval metrics through Vitest.
