# Personal work-experience assistant

Take-home slice: a grounded CLI over two committed knowledge sources. Ask a question; get an answer plus sources, or a refusal. When the sources disagree, both facts are printed. No chat UI, no vector index, no silent winner.

`fixtures/cv.md` is the real CV with synthetic contact details (`example.com` / dummy phone). `fixtures/linkedin.md` is a slim version of that CV; the Lead vs Senior title is a labelled synthetic conflict. Keep the same source ids in goldens.

## Setup (under 10 minutes once Ollama is installed)

**You need**

| On the machine | Notes |
| --- | --- |
| Node.js 20 or newer | `engines.node` is `>=20`. npm ships with it. |
| [Ollama](https://ollama.com) | Default generator and judge. Skip only if you point `ask` at another OpenAI-compatible API. |
| TypeScript, tsx, Vitest, DeepEval | Installed by `npm install` (devDependencies). There is no global `tsc` step. |

npm packages the app imports: `openai`, `dotenv`. Eval also uses `deepeval`, `vitest`, and `ollama` (judge client).

1. Pull the generator and judge:

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

`knowledge/SOURCES.md` is the collect / clean / structure / index note. A new knowledge source is a module in `src/sources/`, one extra array entry, a fixture, then ingest.

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

Reviewer cost: local Ollama only. One eval run is **$0**. No API key of your own unless you point `OPENAI_BASE_URL` at a hosted provider.

### Custom URL, key, and model

`ask` talks to any OpenAI-compatible chat API. Edit `.env` (never commit it):

```bash
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

Same three variables work for another local host (`http://localhost:11434/v1`, `OPENAI_API_KEY=ollama`, `OPENAI_MODEL=llama3.1:8b`) or any compatible proxy. `npm run ask` and `npx tsx eval/latency.ts` pick up `OPENAI_MODEL` from `.env`.

The DeepEval **judge** does not follow that URL. It uses `OLLAMA_HOST` + `JUDGE_MODEL` on a local Ollama daemon. Hosted `ask` still means a local 8B judge unless you change that separately. The CV and question leave this machine if `OPENAI_BASE_URL` is not localhost (see Privacy).


## Knowledge pipeline

| Step | What shipped |
| --- | --- |
| Collect | Real CV copied into `fixtures/cv.md`. LinkedIn is a slim of that CV, not an API export. |
| Clean | Phone and email replaced with `example.com` / dummy number. LinkedIn headline labelled `synthetic: title conflict`. |
| Structure | Ingest splits the CV on `##` into tagged markdown under `knowledge/cv/`. LinkedIn stays one file. |
| Index | None. `retrieveAll()` sends both full sources. The files are the index. |

Detail: [`knowledge/SOURCES.md`](knowledge/SOURCES.md). Why no ranker: [decision 1](docs/decisions.md#1-no-retrieval-layer-and-no-index--send-both-full-documents).

### Conflict in the material

The brief asked for one real conflict, gap, or stale fact, and what happens when a question lands on it. This slice uses a **title that differs between CV and LinkedIn**. There is no overlapping date range and no unfinished-project fixture.

| Source | Coda title |
| --- | --- |
| `fixtures/cv.md` | Senior Software Engineer (Lead) |
| `fixtures/linkedin.md` | Lead Software Engineer (header comment: `synthetic: title conflict`) |

When a question hits that (`What is your title at Coda?`, `Are you a senior engineer?`):

1. `retrieveAll()` sends **both** full documents. The query is unused, so LinkedIn cannot be dropped.
2. The system prompt says: if sources disagree, report both and name the sources. Do not pick a winner. No “LinkedIn is newer” rule.
3. The CLI prints the answer plus `Sources: cv, linkedin` (or whichever ids the model cited).
4. Eval on this question is flaky and model-dependent. `qwen3:4b` names both titles; `llama3.1:8b` often does not. Policy is unchanged: report both wordings, no winner. See [decision 3](docs/decisions.md#3-conflicts-are-reported-not-resolved).

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

The generator sees tagged documents and a short system prompt: stay in context, refuse if missing, name both sides of a disagreement, JSON only. If Ollama is down, times out (180s), or retrieval is empty, the CLI prints a static fallback and does not guess an employer. Unusable JSON: if `answer` is missing, the parse path refuses rather than echoing citations. Rate limits on local Ollama are treated the same as down.

Why this shape: two documents fit in one prompt. An index would answer “What did you do with ClickHouse?”; it would not answer “summarise your work” or “give me a timeline” — those collapse onto Summary + the latest job. See [decision 1](docs/decisions.md#1-no-retrieval-layer-and-no-index--send-both-full-documents). All five calls: [`docs/decisions.md`](docs/decisions.md).

| Call | Choice |
| --- | --- |
| Retrieve | Both full docs; no index. Query unused. |
| Generator | OpenAI SDK → local Ollama (`OPENAI_BASE_URL` is the hosted escape hatch) |
| Conflict | Surface both titles; do not pick a winner |
| Eval | DeepEval GEval only; `mustContain` is a judge label, not a substring lint |
| Store | Markdown fixtures in, tagged markdown out — not YAML-as-source |

**Switch rule.** Keep `qwen3:4b` until prompt work is exhausted and LabelContract still fails `round-up-metrics` or `are-you-senior`. Then a larger local instruct model, then a hosted mini. Switch the judge only if the human vs 8B spot-check on the same five cases drops below 4/5.

## Eval

22 frozen goldens in [`eval/golden.json`](eval/golden.json): 8 direct, 3 multi_source, 4 ambiguous, 3 unanswerable, 4 adversarial (brief asked for ≥20 and all five categories). Behaviours: answer, refuse, conflict. `round-up-metrics` is adversarial **and** answer, so it is not in the refusal suite.

Two metrics (numerator / denominator / pass):

- **LabelContract** — cases with GEval ≥ 0.7 / 22. Did the output follow that case’s behaviour, required facts, and bans?
- **RefusalInjection** — refuse cases with GEval ≥ 0.7 / 6. Did it decline without inventing?
- **Suite** — cases that pass every applicable metric / 22.

Faithfulness is out of scope (M6b). It would not catch the money-shaped miss: agreeing that Data Hub was ~20M when the knowledge says 12M.

Last run (2026-09-03, generator `qwen3:4b`, judge `llama3.1:8b`, ~315s): **17 / 22**. Product misses written up: `working-style` (invented a leadership style), `round-up-metrics` (agreed with 20M). Title conflict (`coda-title`, `are-you-senior`) is flaky and model-dependent: `qwen3:4b` answers it well, `llama3.1:8b` as generator does not. Human vs 8B spot-check: 4 / 5 agree; the disagreement is the judge scoring retrieval context as if it were the answer.

## Limitations, production, 100×

**Now.** 4B generator still fails `working-style` and `round-up-metrics`. Title conflict is flaky across models. 8B judge jitters around 0.60 on short correct answers. Full-doc retrieve will not survive a third large source. Contact lines are synthetic; the title conflict is labelled synthetic.

`working-style` is a **refuse** even though the brief names “how you approach your work.” The Summary’s OKR sentence is lead-scope language, not a working-style claim. Sourced facts (hiring committee, mentoring, end-to-end delivery) can answer “what have you owned”; we will not infer “I’m a servant leader.” That golden is strict on purpose. If a reviewer wants the Summary treated as working style, the golden should change, not the refuse rule.

**Before production.** Fix `round-up-metrics`. Stop filling citations with every retrieved id. Do not point `OPENAI_BASE_URL` at a hosted API without treating the prompt as personal data (see privacy). Add Faithfulness only after those LabelContract misses are understood.

**What breaks first at 100× traffic.** Not QPS. This process is serial local inference. 100× *corpus* blows the context window and the “send everything” retrieve. 100× *questions* queues on one Ollama daemon (p95 already seconds, see below). The first production change is a coverage-preserving retrieve (every employer, every source that can contradict), not a vector DB, plus a hosted generator only after a privacy review.

**Next three**

1. Fix the generator misses: refuse `working-style`, correct Data Hub to 12M.
2. Add Faithfulness (M6b) only after those LabelContract misses are understood — and keep LabelContract as the metric that catches wrong-in-KB numbers.
3. Nightly GEval on frozen goldens, plus one hosted-model smoke via `OPENAI_BASE_URL`. Do not auto-rewrite goldens from a run.

## Privacy and secrets

| Question | Default (local Ollama) | Hosted escape hatch |
| --- | --- | --- |
| Where secrets live | `.env`, gitignored. `OPENAI_API_KEY=ollama` is a dummy. | Real provider key in `.env` only. |
| What leaves this machine | Nothing. Prompt stays on `localhost:11434`. | Full CV + LinkedIn + question, to that provider. |
| Retain / train | N/A (your disk, your daemon). | Whatever that provider’s policy says. Assume retain until you have a DPA. |

`.env.example` names every variable. No real keys are committed. Eval sends answers and retrieval context to the local 8B judge only.

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

Hosted escape hatch: same OpenAI client, `OPENAI_BASE_URL` + key. Both sources plus the system prompt are roughly 2.5–3k input tokens and a short JSON answer. At gpt-4o-mini list prices ($0.15 / 1M input, $0.60 / 1M output, Aug 2026) that is on the order of **$0.0005 per question**, not including a hosted judge. One local eval run is $0; a hosted eval would be 22 generator calls + 28 judge calls.

**Ask latency.** `npx tsx eval/latency.ts` uses `OPENAI_MODEL` from `.env` and writes [`eval/results/latency.md`](eval/results/latency.md) with that name on the page. Paste p50/p95 from a run you trust. The last full eval wall clock (~315s for 22 answers + 28 GEval calls) includes the judge; it is not ask p95.

## AI use

Greenfield for this exercise. No template, no prior project. DeepEval is a library. `scripts/patch-deepeval-telemetry.mjs` stubs missing telemetry exports so Vitest can run; it is not product code.

Cursor agents wrote most of the TypeScript, DeepEval wiring, and judge-prompt drafts. I owned the locked calls in `plan.md` and `docs/decisions.md`, the golden set, the 0.7 bar before reading scores, the product-vs-jitter split, and the human side of the 5-case spot-check. Goldens were not generated from a model run.

What I changed after reviewing generated code:

- Cut the system prompt so `qwen3:4b` stops spending its budget on extra edge cases.
- Rewrote GEval `evaluationSteps` after the 8B judge scored retrieval context as if it were the answer.
- Kept `mustContain` as judge labels, not a substring linter the model had started to imply.
- Added the telemetry stub when `npx deepeval test run` died on `captureCliCommand`.

## Time spent

Brief box: 120 minutes. Actual: close to **3 hours**. Most of that was planning, eval strategy, and judge/prompt tuning. Ingest / `ask` / CLI were the smaller part. Faithfulness, a UI, and an index stayed cut.
