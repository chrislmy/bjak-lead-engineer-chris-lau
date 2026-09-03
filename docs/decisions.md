# Decision record

Five calls that are locked for this slice. Status is **accepted** unless noted.

---

## 1. No retrieval layer and no index — send both full documents

**Status.** Accepted.

**Context.** Two small sources. A typical RAG stack would chunk, embed, take the question, and prompt with top-k. That is the right tool when the corpus is large and most of it should be thrown away. It is the wrong tool for the questions a recruiter actually asks first.

**Decision.** There is no search index and no query-time retrieval. `retrieveAll()` takes no argument (the unit test asserts `retrieveAll.length === 0`). It reads every registered source in full. Ingest may split the CV on `##` so a human can read `MANIFEST.md`; retrieve concatenates those files back into one `cv` document. The split is for inspection, not ranking. The files are the index.

**Be honest about what an index *would* answer.** Direct, noun-heavy questions share vocabulary with the fixtures. Top-k would likely work: “What did you do with ClickHouse?”, “How much traffic did Data Hub handle?”, “Where did you study?”, “What AWS cert do you hold?” Those are eval goldens, not recruiter openers. Pretending an index cannot answer them is false.

**The actual hole is coverage, not “semantics” in the embedding sense.** Embeddings *do* paraphrase. “Payments experience” will often retrieve Capital One; “leadership” will often retrieve mentor / hiring committee / OKRs. BM25 is what dies on recruiter vernacular. Vector search still fails the questions that need **every role, in order**, because the query is most similar to *one* region of the CV (usually Summary, or the longest latest job) and top-k stops there. Similarity optimises resemblance. A career recap needs recall.

Recruiters open with aggregative questions, not keyword lookups:

| Recruiter question | What top-k tends to return | What is missing |
| --- | --- | --- |
| Summarise your work experience. | `## Summary` (it is literally named that) | Ocado, Capital One, dates, progression |
| Give me a timeline of your career. | Coda (most text, most recent) | Deliveroo → Ocado → Capital One, month/year |
| Walk me through your CV. | Summary + Coda employment | Same — the walk-through *is* the whole file |
| How did you get from Capital One to here? | Capital One *or* Coda, not both | The path: payments → OSP → dispatch → experimentation |
| What’s your career progression? | Current title on CV or LinkedIn | Software Engineer → Senior → Senior (Lead) / Lead |
| Have you led people, or only systems? | Summary “lead responsibilities” | Hiring committee, mentoring, Deliveroo stacking lead — or a refuse if we will not infer |
| Have you worked in payments or anything money-adjacent? | Maybe Capital One if the embed is good | Credit-card plans, CDC accounting tables, Credit Card Sanitizer — three places, none say “fintech” |
| Have you operated anything at scale? | ClickHouse 300M (strong lexical hit) | Data Hub 12M, Deliveroo ~1M orders/day, Snowflake petabytes |
| How is Coda different from Deliveroo? | The longer Coda section | Dispatch / DynamoDB / Go migration never enter the prompt |
| What should a hiring panel know in 60 seconds? | Summary paragraph | Concrete employers, scope, and the title conflict |

The failure mode is not “no hit.” It is a **confident, incomplete** answer: sounds like a senior experimentation engineer, erases Ocado and Capital One, and never mentions the Lead vs Senior disagreement.

**Secondary, still real, not the main reason.** A labelled title conflict can disappear if k is small and LinkedIn is shorter. Absence (`salary`, `why-bjak`) is a generation rule; nearest-neighbour always returns something unless you add a threshold, and thresholds are a different product. `working-style` is a weak golden here — the Summary *is* semantically a working-style paragraph. An index is not uniquely to blame.

**Alternatives considered**

| Option | Why not for this slice |
| --- | --- |
| BM25 over sections | Dies on “timeline”, “walk me through”, “fintech”, “scale”, “leadership”. |
| Embeddings + top-k | Paraphrase improves; aggregative questions still collapse onto Summary + Coda. |
| top-k but force one chunk per source | Fixes LinkedIn-drop; does not give a timeline. |
| Retrieve each `##` file, still no ranker | Prompt noise. We already glue sections back. |

**Consequences.** Token cost is bounded by fixture size, not by question. Direct ClickHouse questions would survive an index; “summarise your experience” would not. A third large source is when this is revisited — then retrieve for coverage (every employer, every source that can contradict), not raw similarity. Adding a source is still one module plus one array entry, then ingest.

---

## 2. OpenAI SDK against Ollama, not an Ollama-only client

**Context.** Local generator is Ollama `qwen3:4b`. A hosted model must remain an env change, not a rewrite.

**Decision.** `src/llm/client.ts` uses the OpenAI SDK with `OPENAI_BASE_URL` / `OPENAI_API_KEY` / `OPENAI_MODEL`. Defaults talk to `http://localhost:11434/v1`. The DeepEval judge uses `OllamaModel` because GEval is wired that way; that is a judge detail, not the product API.

**Why not the Ollama HTTP API for `ask`.** The product path should match what a reviewer would point at OpenAI or another compatible host. Streaming is used only so `--think` can print reasoning; the public contract is still `{ answer, citations, refused }`.

**Consequences.** Escape hatch: point `OPENAI_BASE_URL` at a hosted API and set a real key. Judge remains local unless DeepEval is reconfigured.

---

## 3. Conflicts are reported, not resolved

**Context.** The LinkedIn headline is a labelled synthetic conflict with the CV title. A 4B model will pick a winner if allowed.

**Decision.** System prompt, goldens (`coda-title`, `are-you-senior`), and judge steps all require both facts. The assistant must not decide that Lead supersedes Senior, or that “Lead” in parentheses is the same as the LinkedIn headline.

**Why not “most recent source wins”.** That is a product policy pretending to be retrieval. The reviewer should see the disagreement.

**Consequences.** Yes/no questions are a known failure mode (`are-you-senior` answered `Yes` on the last run). That is a generator miss, not a reason to relax the policy.

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

**Why not YAML-as-source.** The artefact a reviewer opens should look like a CV. Frontmatter is generated tags (`id`, `source`, `origin`), not an authoring format.

**Consequences.** Split is `##` only, so `###` roles stay inside Employment History. No search. Replace placeholders in place and keep the same source ids.
