# Decision record

Five calls that are locked for this slice. Status is **accepted** unless noted.

---

## 1. No retrieval layer and no index — send both full documents

**Status.** Accepted.

**Context.** Two small sources. A typical RAG stack would chunk, embed, take the question, and prompt with top-k. That is the right tool when the corpus is large and most of it should be thrown away. It is the wrong tool when a correct answer needs every role, or both sources, not the chunk that looks most like the query.

**Decision.** There is no search index and no query-time retrieval. `retrieveAll()` takes no argument (the unit test asserts `retrieveAll.length === 0`). It reads every registered source in full. Ingest may split the CV on `##` so a human can read `MANIFEST.md`; retrieve concatenates those files back into one `cv` document. The split is for inspection, not ranking. The files are the index.

**What an index would still answer.** Direct questions that share nouns with the fixtures: “What did you do with ClickHouse?”, “How much traffic did Data Hub handle?”, “Where did you study?”, “What AWS cert do you hold?” Top-k would likely work. Pretending it cannot is false.

**The hole is coverage, not “embeddings don’t understand meaning.”** Embeddings *do* paraphrase. “Payments experience” will often retrieve Capital One; “leadership” will often retrieve mentor / hiring committee / OKRs. BM25 is what dies on those paraphrases. Vector search still fails queries that need **every role, in order**, because the query is most similar to *one* region (usually Summary, or the longest latest job) and top-k stops there. Similarity optimises resemblance. A recap needs recall.

| Query | What top-k tends to return | What is missing |
| --- | --- | --- |
| Summarise the work experience. | `## Summary` (it is literally named that) | Ocado, Capital One, dates, progression |
| Give a timeline of roles. | Coda (most text, most recent) | Deliveroo → Ocado → Capital One, month/year |
| Walk through the CV. | Summary + Coda employment | The walk-through *is* the whole file |
| How did the path from Capital One to Coda go? | Capital One *or* Coda, not both | payments → OSP → dispatch → experimentation |
| Have they operated anything at scale? | ClickHouse 300M (strong lexical hit) | Data Hub 12M, Deliveroo ~1M orders/day, Snowflake petabytes |
| How is Coda different from Deliveroo? | The longer Coda section | Dispatch / DynamoDB / Go migration never enter the prompt |

The failure mode is not “no hit.” It is a **confident, incomplete** answer: latest job only, Ocado and Capital One gone, title conflict never mentioned.

**Secondary, still real, not the main reason.** A labelled title conflict can disappear if k is small and LinkedIn is shorter. Absence (`salary`, `why-bjak`) is a generation rule; nearest-neighbour always returns something unless you add a threshold, and thresholds are a different product. `working-style` is a weak golden here — the Summary *is* semantically a working-style paragraph. An index is not uniquely to blame.

**Alternatives considered**

| Option | Why not for this slice |
| --- | --- |
| BM25 over sections | Dies on “timeline”, “walk through”, “fintech”, “scale”, “leadership”. |
| Embeddings + top-k | Paraphrase improves; aggregative questions still collapse onto Summary + Coda. |
| top-k but force one chunk per source | Fixes LinkedIn-drop; does not give a timeline. |
| Retrieve each `##` file, still no ranker | Prompt noise. We already glue sections back. |

**Consequences.** Token cost is bounded by fixture size, not by question. Direct ClickHouse questions would survive an index; “summarise the experience” would not. A third large source is when this is revisited — then retrieve for coverage (every employer, every source that can contradict), not raw similarity. Adding a source is still one module plus one array entry, then ingest.

---

## 2. OpenAI SDK against Ollama, not an Ollama-only client

**Context.** Local generator is Ollama `qwen3:4b`. A hosted model must remain an env change, not a rewrite.

**Decision.** `src/llm/client.ts` uses the OpenAI SDK with `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL`. Defaults talk to `http://localhost:11434/v1`. The DeepEval judge uses `OllamaModel` because GEval is wired that way; that is a judge detail, not the product API.

**Why not the Ollama HTTP API for `ask`.** The product path should match any OpenAI-compatible host. Streaming is used only so `--think` can print reasoning; the public contract is still `{ answer, citations, refused }`.

**When I would switch generator.** Prompt work is exhausted and LabelContract still fails the money-shaped or conflict cases (`round-up-metrics`, `are-you-senior`) on a fresh run. Then try a larger local instruct model (8B-class) before a hosted mini. Switch the judge only if the human vs 8B spot-check drops below 4/5 on the same five cases. Do not switch because a blog prefers another name.

**Consequences.** Escape hatch: point `OPENAI_BASE_URL` at a hosted API and set a real key. CV text then leaves the machine (see README privacy). Judge remains local unless DeepEval is reconfigured.

---

## 3. Conflicts are reported, not resolved

**Context.** The LinkedIn headline is a labelled synthetic conflict with the CV title. A 4B model will pick a winner if allowed.

**Decision.** System prompt, goldens (`coda-title`, `are-you-senior`), and judge steps all require both facts. The assistant must not decide that Lead supersedes Senior, or that “Lead” in parentheses is the same as the LinkedIn headline.

**Why not “most recent source wins”.** That is a policy pretending to be retrieval. The caller should see both wordings.

**Consequences.** Eval on the title conflict is flaky and model-dependent. `qwen3:4b` names both wordings; `llama3.1:8b` as generator often does not. Policy is unchanged.

---

## 4. DeepEval GEval only — no custom substring metric

**Context.** Goldens carry `mustContain` / `mustNotClaim`. It is tempting to `includes()` those strings and skip a judge.

**Decision.** Those fields are labels for the judge, not a linter. Paraphrase counts. `behaviour` is `answer` | `refuse` | `conflict`; refusal is `behaviour === "refuse"`, not “every adversarial case”.

**Why not a custom matcher.** `Not specified` is a valid refuse. `University College London (UCL)` is a valid education answer. `yes` to “Data Hub was ~20 million” is a fail even if the word ClickHouse never appears. Substring tests get all three wrong. GEval with committed `evaluationSteps` is the judge prompt.

**Consequences.** The 8B judge is noisy (0.60 vs 0.80 on a correct short answer). Pass bar is GEval ≥ 0.7, stated before looking at a run. Jitter is written up separately from product misses.

---

## 5. Markdown fixtures are the source of truth, not YAML

**Context.** A structured store (YAML, SQLite, a vector DB) would make ingest look more “engineered”.

**Decision.** Humans edit `fixtures/*.md`. Ingest writes tagged markdown under `knowledge/<source>/` plus `MANIFEST.md`. `ask` reads those generated files only.

**Why not YAML-as-source.** The source of truth should still look like a CV. Frontmatter is generated tags (`id`, `source`, `origin`), not an authoring format.

**Consequences.** Split is `##` only, so `###` roles stay inside Employment History. No search. Replace placeholders in place and keep the same source ids.
