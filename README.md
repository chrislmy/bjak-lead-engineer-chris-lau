# Personal work-experience assistant

Take-home slice: a grounded CLI over two committed knowledge sources. Ask a question; get an answer plus sources, or a refusal. When the sources disagree, both facts are printed. No chat UI, no vector index, no silent winner.

`fixtures/cv.md` is the real CV with synthetic contact details (`example.com` / dummy phone). `fixtures/linkedin.md` is a slim version of that CV; the Lead vs Senior title is a labelled synthetic conflict. Keep the same source ids in goldens.

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

`knowledge/SOURCES.md` describes the fixtures. A new knowledge source is a module in `src/sources/`, one extra array entry, a fixture, then ingest.

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

## Architecture

```
fixtures/cv.md  fixtures/linkedin.md
        │  npm run ingest
        ▼
knowledge/<source>/*.md   knowledge/MANIFEST.md
        │  retrieveAll() — both sources, query unused
        ▼
ask() → OpenAI SDK → Ollama qwen3:4b
        ▼
stdout: answer, Sources, thought for <duration>
```

`ingest` is the write path. `ask` never writes knowledge. Each source module exports `ingest()` and `retrieve()`; [`src/sources/index.ts`](src/sources/index.ts) is the registry.

The generator sees tagged documents and a short system prompt: stay in context, refuse if missing, name both sides of a disagreement, JSON only. If Ollama is down or retrieval is empty, the CLI prints a static fallback and does not guess an employer.

Why this shape: two documents fit in one prompt. An index would answer “What did you do with ClickHouse?”; it would not answer “summarise your work” or “give me a timeline” — those collapse onto Summary + the latest job. See [decision 1](docs/decisions.md#1-no-retrieval-layer-and-no-index--send-both-full-documents). All five calls: [`docs/decisions.md`](docs/decisions.md).

| Call | Choice |
| --- | --- |
| Retrieve | Both full docs; no index. Query unused. |
| Generator | OpenAI SDK → local Ollama (`OPENAI_BASE_URL` is the hosted escape hatch) |
| Conflict | Surface both titles; do not pick a winner |
| Eval | DeepEval GEval only; `mustContain` is a judge label, not a substring lint |
| Store | Markdown fixtures in, tagged markdown out — not YAML-as-source |

## Eval

22 frozen goldens in [`eval/golden.json`](eval/golden.json): 8 direct, 3 multi_source, 4 ambiguous, 3 unanswerable, 4 adversarial. Behaviours: answer, refuse, conflict. `round-up-metrics` is adversarial **and** answer, so it is not in the refusal suite.

Two metrics:

- **LabelContract** — every case. Did the output follow that case’s behaviour, required facts, and bans?
- **RefusalInjection** — `behaviour === "refuse"` only (6 cases). Did it decline without inventing?

Faithfulness is out of scope (M6b). It would not catch the money-shaped miss: agreeing that Data Hub was ~20M when the knowledge says 12M.

Last run (2026-09-03, generator `qwen3:4b`, judge `llama3.1:8b`, ~315s): **17 / 22**. Product misses written up: `working-style` (invented a leadership style), `round-up-metrics` (agreed with 20M). `are-you-senior` also collapsed the title conflict to `Yes`. Human vs 8B spot-check: 4 / 5 agree; the disagreement is the judge scoring retrieval context as if it were the answer.

## Limitations and next three

**Now.** 4B generator still fails three grounded cases. 8B judge jitters around 0.60 on short correct answers. Full-doc retrieve will not survive a third large source. Goldens are 22, not the planned 25 (cut one multi_source, one unanswerable, one adversarial). Contact lines are synthetic; the title conflict is labelled synthetic.

**Next three**

1. Fix the three generator misses: refuse `working-style`, correct Data Hub to 12M, name both titles on `are-you-senior`.
2. Add Faithfulness (M6b) only after those LabelContract misses are understood — and keep LabelContract as the metric that catches wrong-in-KB numbers.
3. Nightly GEval on frozen goldens, plus one hosted-model smoke via `OPENAI_BASE_URL`. Do not auto-rewrite goldens from a run.

## If I reviewed this PR

Two comments I would leave:

1. **Citation fill-in over-claims support.** When the model answers and omits `citations`, `parseModelJson` attaches every retrieved id. That avoids an unsourced answer on the CLI, but a CV-only fact then prints `Sources: cv, linkedin`. Prefer empty citations over a LinkedIn citation the text does not support.

2. **17 / 22 is an honest eval, not a ship gate for amounts.** `round-up-metrics` agreed with an inflated 20M. That is the failure that matters if this pattern ever sits near money movement. I would not tag “grounded” until that case passes LabelContract, even if the suite score looks fine.

## One thing I would not let a model decide

The Coda title. The CV says Senior Software Engineer (Lead); LinkedIn says Lead Software Engineer. A generator will pick one. The system prompt, two goldens, and the judge steps all say: name both, no winner. I also would not let a model move the 0.7 pass bar after seeing scores, or rewrite `mustContain` to match whatever it just said.

## Money-movement and continuous eval

If this assistant sat next to balances or event counts, the analogue of a bad pay-out is `round-up-metrics`: the user supplies a friendlier number, the model agrees, Faithfulness can still look clean because the lie is agreement, not invention.

What I would actually run:

| Layer | When | What |
| --- | --- | --- |
| Unit tests (`npm test`) | Every PR | JSON parse, retrieve both sources, golden shape, GEval steps present |
| GEval suite (`npm run eval`) | Nightly | Frozen goldens; LabelContract on amount/identity cases is the gate |
| Golden edits | Human PR only | No job that mutates `eval/golden.json` from model output |
| Merge gate | Not the 8B judge | Jitter (Ocado 0.60 on a correct name) must not block; product misses must |

Local eval cost is $0. Do not “fix” a nightly fail by loosening `mustNotClaim`.

## Latency and cost

Local generator and judge: **$0 / question** (electricity aside).

Hosted escape hatch: same OpenAI client, `OPENAI_BASE_URL` + key. Both sources plus the system prompt are roughly 2.5–3k input tokens and a short JSON answer. At gpt-4o-mini list prices ($0.15 / 1M input, $0.60 / 1M output, Aug 2026) that is on the order of **$0.0005 per question**, not including a hosted judge.

Latency: each `ask` prints `thought for <duration>` (model call only). The last full eval was **~315s wall clock for 22 generator answers + 28 GEval calls** (~14s mean including the 8B judge). A dedicated ask-only p95 was not sampled in this write-up; use the per-question duration line, not the eval total, if you need p95.

## AI use

Cursor agents wrote most of the TypeScript, DeepEval wiring, and judge-prompt iterations. I owned the locked calls in `plan.md` and `docs/decisions.md`, the golden set (questions, behaviours, bans), the 0.7 bar before reading scores, the product-vs-jitter split in `eval/results/latest.md`, and the human side of the 5-case spot-check. Goldens were not generated from a model run.

## Time spent

Plan box: ~120 minutes. This overran. The product path (ingest, retrieve, `ask`, CLI) was the smaller part. Most of the extra time was M6: GEval steps, 8B jitter, two failure write-ups, spot-check. This README is M8.

I am not inventing a round hour count. No secrets are committed (`.env` is gitignored; `.env.example` is placeholders).
