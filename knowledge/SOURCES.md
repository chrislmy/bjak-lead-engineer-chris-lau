# Sources

Edit this file when a fixture is added or replaced.

## Ingest

`fixtures/` is input. `npm run ingest` writes markdown under `knowledge/<source>/` (one file per `##` heading, or one file if the fixture has none) and updates `MANIFEST.md`.

`ask` reads those generated files only.

## Current sources

| Source | File | Split | Notes |
| --- | --- | --- | --- |
| cv | `fixtures/cv.md` | `##` headings | Real CV. Contact lines are synthetic (`christopher.lau@example.com`, `+60 12 0000 0000`). |
| linkedin | `fixtures/linkedin.md` | single file | Slim CV. Headline is Lead Software Engineer (labelled conflict with CV Senior Software Engineer (Lead)). Includes `experimentation analytics`, which the CV does not. |

Keep ids `cv` and `linkedin`.

## Limits

Split is `##` only, so roles under `###` stay in Employment History. Every question gets both sources in full. There is no search index.

A new source is a module in `src/sources/`, one extra entry in the `sources` array, a fixture, then ingest.
