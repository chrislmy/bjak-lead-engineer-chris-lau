# Sources

Edit this file when a fixture is added or replaced.

## Collect, clean, structure, index

| Step | What we did |
| --- | --- |
| Collect | Copied the real CV into `fixtures/cv.md`. Wrote `fixtures/linkedin.md` as a slim of that CV, not an API pull. |
| Clean | Replaced phone and email with `example.com` / dummy Malaysian number. Labelled the LinkedIn headline as a synthetic title conflict. No other employers or metrics were invented. |
| Structure | Ingest splits the CV on `##` into one markdown file per section, with YAML frontmatter (`id`, `source`, `origin`). LinkedIn has no `##` headings, so it stays one file. |
| Index | There is none. `retrieveAll()` concatenates every file for a source and sends **both** sources, query unused. The files are the index. See [decision 1](../docs/decisions.md#1-no-retrieval-layer-and-no-index--send-both-full-documents). |

`fixtures/` is input. `npm run ingest` writes `knowledge/<source>/` and `MANIFEST.md`. `ask` reads those generated files only.

## Current sources

| Source | File | Split | Notes |
| --- | --- | --- | --- |
| cv | `fixtures/cv.md` | `##` headings | Real CV. Contact lines are synthetic (`christopher.lau@example.com`, `+60 12 0000 0000`). |
| linkedin | `fixtures/linkedin.md` | single file | Slim CV. Headline is Lead Software Engineer (labelled conflict with CV Senior Software Engineer (Lead)). Includes `experimentation analytics`, which the CV does not. |

Keep ids `cv` and `linkedin`.

## Conflict

The planted disagreement is the Coda title, not overlapping dates or an unfinished project.

- CV: Senior Software Engineer (Lead)
- LinkedIn: Lead Software Engineer (`<!-- synthetic: title conflict ... -->`)

A question that lands on it still gets both full sources. The model is told to name both wordings and not pick a winner. Eval on `coda-title` / `are-you-senior` is flaky and model-dependent: `qwen3:4b` does this well, `llama3.1:8b` as generator does not.



## Limits

Split is `##` only, so roles under `###` stay in Employment History. Every question gets both sources in full.

A new source is a module in `src/sources/`, one extra entry in the `sources` array, a fixture, then ingest.
