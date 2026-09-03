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

## Limits

Split is `##` only, so roles under `###` stay in Employment History. Every question gets both sources in full.

A new source is a module in `src/sources/`, one extra entry in the `sources` array, a fixture, then ingest.
