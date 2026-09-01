# Sources

Edit this file when a fixture is added or replaced.

## Ingest

`fixtures/` is input. `npx tsx src/cli.ts ingest` writes markdown under `knowledge/<source>/` (one file per `##` heading, or one file if the fixture has none) and updates `MANIFEST.md`.

`ask` reads those generated files only.

## Current sources

| Source | File | Split | Notes |
| --- | --- | --- | --- |
| cv | `fixtures/cv.md` | `##` headings | Real CV. Contact lines are synthetic (`christopher.lau@example.com`, `+60 12 0000 0000`). |
| linkedin | `fixtures/linkedin.md` | single file | Placeholder. Title is Lead Software Engineer (intentional conflict with the CV Senior title). Includes `experimentation analytics`, which the CV does not. |

Swap LinkedIn for a real export when you have one. Keep ids `cv` and `linkedin`.

## Limits

Split is `##` only, so roles under `###` stay in Employment History. Every question gets both sources in full. There is no search index.

A new source is a module in `src/sources/`, one extra entry in the `sources` array, a fixture, then ingest.
