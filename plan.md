# Personal work-experience assistant ù implementation plan

Time box: ~120 minutes. Goal: a thin, grounded, evaluable slice ù not a complete system.

Fixtures are **placeholders** until real CV / LinkedIn content is dropped in. Tickets below use a stable placeholder schema so ingest, retrieve, `ask`, and goldens can be wired without waiting on biography.

**Eval split:** LabelContract + Refusal are the eval milestone. Faithfulness is a later, optional ticket.

---

## Decisions (locked)

| Decision | Choice |
|---|---|
| Generator | Ollama `qwen3:4b` via OpenAI SDK (`baseURL` ? `http://localhost:11434/v1`) |
| Judge | Ollama `llama3.1:8b` via DeepEval `OllamaModel` |
| Knowledge | Markdown fixtures ? tagged `knowledge.md` |
| Retrieve | Full documents from **both** sources every time (query unused) |
| Conflict | Surface both facts; do not pick a winner |
| Ingest vs retrieve | Write path vs read path; `ask` does not ingest |
| Source shape | One module per source: `ingest()` + `retrieve()` (not separate Ingestor/Retriever interfaces) |
| Index | None. The file is the index |
| Custom eval matcher | None. DeepEval GEval only for labels/refusal |
| UI | CLI only |

---

## Still open (does not block M1ùM7)

- Repo name: `bjak-lead-engineer-<yourname>`
- Real vs synthetic labels on fixtures (fill when replacing placeholders)
- Exact p95 / cost numbers (measure in M8)
- Whether to add Faithfulness (M6b) before tagging `submission`

---

## Placeholder knowledge contract

Until real content exists, fixtures **must** contain these strings so goldens and ingest stay honest. Replace in place later; keep the same ids in `eval/golden.json` and rewrite `mustContain` / `mustNotClaim` to match the new text.

**`fixtures/cv.md`**

- Employer: `Coda`
- Title: `Senior Software Engineer`
- Experimentation: `ClickHouse`, `300M`
- Data Hub: `12M`

**`fixtures/linkedin.md`**

- Title: `Lead Software Engineer` (intentional conflict)
- At least one bullet **not** copied from the CV (e.g. `experimentation analytics`)
- Header comment: `synthetic: title conflict` until you know otherwise

---

## Milestone map

```
M1 Skeleton
 ? M2 Placeholder fixtures
 ? M3 Ingest
 ? M4 Grounded ask
 ? M5 Golden dataset
 ? M6 Label + Refusal eval
 ? M6b Faithfulness (optional)
 ? M7 CLI
 ? M8 Write-up + tag
```

Do not start M5 until M2 strings exist. Do not start M6 until `ask` returns an answer + sources (M4).

Each ticket is a **deliverable**: something a reviewer can run or read without the next ticket.

---

## M1 ù Runnable skeleton

**Deliverable:** Empty app that installs and prints CLI usage.

**In**

- `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`
- `src/cli.ts` ù usage only (`ingest` / `ask` / `eval` stub)
- `src/env.ts` ù read `OPENAI_BASE_URL`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `JUDGE_MODEL`
- README stub: Ollama install, `ollama pull qwen3:4b`, `ollama pull llama3.1:8b`

**Out**

- Ingest, LLM, eval

**Acceptance**

- [ ] `npm install` succeeds
- [ ] `npx tsx src/cli.ts` prints the three commands
- [ ] `.env.example` names every variable; no real secrets committed

**Commit:** `chore: project skeleton and env example`

---

## M2 ù Placeholder knowledge sources

**Deliverable:** Committed fixtures a reviewer can open without running code.

**Depends on:** M1 (repo exists)

**In**

- `fixtures/cv.md` ù placeholder Coda / ClickHouse / Data Hub / Senior title
- `fixtures/linkedin.md` ù Lead title + one extra bullet + synthetic label
- One line in README: what is placeholder vs what you will replace

**Out**

- Ingest code, `knowledge.md` (except you may add an empty dir)

**Acceptance**

- [ ] Both files exist and contain the placeholder contract strings above
- [ ] Title conflict is visible by reading the two files
- [ ] LinkedIn has at least one fact not in the CV
- [ ] Synthetic / placeholder is labelled

**Commit:** `docs: add placeholder cv and linkedin fixtures`

---

## M3 ù Ingest both sources

**Deliverable:** `ingest` writes tagged `knowledge/knowledge.md` from both fixtures.

**Depends on:** M2

**In**

- `src/sources/cv.ts`, `src/sources/linkedin.ts` ù each `ingest()` + `retrieve()` (retrieve can wait until M4 if you prefer, but the module should exist)
- `src/sources/index.ts` ù `ingestAll()`
- `src/cli.ts ingest` wired

**Out**

- LLM, eval, query-based retrieval

**Acceptance**

- [ ] `npx tsx src/cli.ts ingest` regenerates `knowledge/knowledge.md`
- [ ] File contains both sources with `source:cv` and `source:linkedin` fences (or equivalent tags)
- [ ] Conflict is still present after ingest (both titles)
- [ ] Adding a third source is ùnew file + one array entryù (stated in a code comment or README)

**Commit:** `feat: ingest fixtures into tagged knowledge`

---

## M4 ù Grounded `ask`

**Deliverable:** Ask a question; get an answer plus sources, or a clear refusal. Conflicts not silently resolved.

**Depends on:** M3

**In**

- `retrieveAll()` ù both full docs; **do not use the query**
- `src/llm/client.ts` ù OpenAI SDK, env `baseURL` / `apiKey` / `model`
- `src/assistant.ts` ù prompt: stay in supplied context; refuse if insufficient; surface disagreements
- Structured enough output to print sources (`{ answer, citations }` or equivalent)
- Empty retrieval or LLM timeout/down ? static fallback, **no invented facts**
- `src/cli.ts ask "..."` prints answer + sources

**Out**

- DeepEval, 25 goldens, streaming, chat UI

**Acceptance** (manual; three commands)

- [ ] Direct: ClickHouse question cites CV and mentions experimentation / 300M or ClickHouse
- [ ] Unanswerable: salary or BJAK policy ? refusal, no fabricated figure
- [ ] Conflict: title at Coda ? both Senior and Lead, no single winner
- [ ] Ollama stopped (or bad host) ? fallback message, not a guessed employer

**Commit:** `feat: grounded ask with dual-source retrieve`

---

## M5 ù Frozen golden dataset

**Deliverable:** 25 labelled cases committed; contract helper for DeepEval.

**Depends on:** M2 (strings). Prefer M4 done so questions match real `ask` behaviour, but goldens can be authored against fixtures alone.

**In**

- `eval/golden.json` ù 25 cases (8 direct, 4 multi_source, 4 ambiguous, 4 unanswerable, 5 adversarial)
- `eval/golden.ts` ù types + `contractText(g)` building `BEHAVIOUR` / `MUST CONTAIN` / `MUST NOT CLAIM`
- Every `mustContain` substring exists in fixtures (or in `knowledge.md` after ingest)

**Out**

- Running DeepEval (that is M6)

**Acceptance**

- [ ] Counts: 8 / 4 / 4 / 4 / 5
- [ ] `behaviour` is `answer` | `refuse` | `conflict`
- [ ] Refusal suite is defined as `behaviour === "refuse"` (not ùall adversarialù)
- [ ] `round-up-metrics` (or equivalent) is `adversarial` + `answer` so it is **not** in the refusal set

**Commit:** `test: add 25 golden cases`

---

## M6 ù LabelContract + Refusal eval (required)

**Deliverable:** One command scores goldens with two GEval metrics; results committed.

**Depends on:** M4, M5

**In**

- `eval/geval.ts` ù `OllamaModel` judge `llama3.1:8b`; `labelContract`; `refusalInjection`
- `eval/assistant.eval.ts` ù `it.each` all goldens ? LabelContract; filter `behaviour === "refuse"` ? RefusalInjection
- `vitest.config.ts` ù long `testTimeout` / `hookTimeout`
- `eval/results/` ù last run output (table or DeepEval report) plus **two** failure write-ups
- Spot-check: you vs 8B on 5 cases (one per category); agreement noted in results or README

**Out**

- Faithfulness (M6b)
- Answer relevancy
- Custom substring matcher
- Confident AI login

**Acceptance**

- [ ] `npx deepeval test run eval/assistant.eval.ts` runs without Python
- [ ] Pass bar stated **before** interpreting results (e.g. GEval ? 0.7)
- [ ] Suite formula written: cases passing all **applicable** metrics / n
- [ ] `evaluationSteps` committed (they are the judge prompt)
- [ ] Two real failures explained (not ùwill fail laterù)

**Commit:** `test: deepeval label and refusal suite`  
**Commit:** `docs: commit eval results and failure notes`

---

## M6b ù Faithfulness (optional)

**Deliverable:** `FaithfulnessMetric` on all 25 with `retrievalContext` from `retrieveAll()`.

**Depends on:** M6

**Do this only if** M6 results are committed and time remains before M8.

**Acceptance**

- [ ] Same `deepeval test run` includes Faithfulness
- [ ] README: Faithfulness does not catch wrong-in-KB facts (Data Hub vs 300M); LabelContract does
- [ ] Hallucination rate defined as share of cases with Faithfulness < 0.7 (if you report it)

**Commit:** `test: add faithfulness metric`

---

## M7 ù CLI as the product

**Deliverable:** Three documented commands; `eval` is one path a reviewer can copy.

**Depends on:** M3, M4, M6

**In**

- `ingest` / `ask` / `eval` (`eval` may shell `npx deepeval test run ù`)
- `ask` always shows sources or the fallback

**Out**

- Web UI, history, streaming (optional; skip)

**Acceptance**

- [ ] README lists exactly the commands to run in &lt;10 minutes (plus Ollama pulls)
- [ ] `eval` is one documented command

**Commit:** `feat: cli for ingest ask eval`

---

## M8 ù Leadership write-up and submission

**Deliverable:** README is the entry point; history is readable; tag exists.

**Depends on:** M7 (and M6). M6b optional.

**In**

- README: what it is; install/run; architecture + why; eval approach + results; limitations + next three; AI-use; **time spent** (honest, including overrun)
- `docs/decisions.md` (or README section): 3ù5 ADRs (full-doc vs query retrieve; OpenAI SDK + Ollama; conflict policy; GEval vs custom matcher; skip YAML-as-source)
- Cuts + next three
- One thing you refused to let a model decide
- Self-review: two PR comments
- Money-movement + continuous eval (CI / nightly / no auto-mutating goldens)
- Measured p95 and cost/question (`$0` locally + hosted escape hatch)
- `git tag submission`

**Out**

- New features

**Acceptance**

- [ ] Another engineer can run from README alone
- [ ] Multiple meaningful commits (not one dump)
- [ ] No committed secrets

**Commit:** `docs: readme and decision record`

---

## Explicitly out of scope (all milestones)

Vector DB, embeddings, SQLite/FTS5, LangChain, PDF parser, query-dependent retrieval, YAML-as-only-store, custom `BaseMetric` / substring scorer, chat UI, Confident AI, auto-updating goldens, `Ingestor` + `Retriever` as two plugin systems.

---

## If the clock runs out

Cut in this order: M6b ? extra source files (flatten retrieve) ? separate `docs/decisions.md` (fold into README).

Never cut: M2ùM4 behaviours (sources, refuse, conflict), M5 count/categories, M6 run + two failures, M8 README + time spent.

---

## After placeholders are replaced

1. Edit `fixtures/*.md` with real/redacted content.  
2. Re-run ingest.  
3. Rewrite `mustContain` / `mustNotClaim` so every string is in the new KB.  
4. Re-run M6; commit new `eval/results/`.  
5. Update README redaction / synthetic list.
