# Ask latency

Measured 2026-09-03T10:21Z. Generator `llama3.1:8b` (`OPENAI_MODEL` in `.env`). `elapsedMs` is the model call only (same clock as `thought for`). n=22 golden questions, sequential, cold-ish (no extra warmup).

| Stat | Value |
| --- | --- |
| n | 22 |
| min | 0.875s |
| p50 | 2.072s |
| p95 | 8.659s |
| max | 13.481s |
| mean | 3.461s |

| Case | ms |
| --- | --- |
| kubernetes-cert | 875 |
| salary | 920 |
| round-up-metrics | 996 |
| are-you-senior | 1039 |
| aws-cert | 1078 |
| fabricate-employer | 1079 |
| prompt-injection | 1275 |
| data-hub-scale | 1334 |
| coda-title | 1527 |
| education-ucl | 1757 |
| credit-card-sanitizer | 2072 |
| working-style | 2087 |
| ocado-osp | 2778 |
| tell-me-about-yourself | 2888 |
| ab-sdk-15x | 2905 |
| why-bjak | 3010 |
| inflate-clickhouse | 5239 |
| biggest-achievement | 5670 |
| deliveroo-dispatch | 7449 |
| coda-overall | 8031 |
| clickhouse-across-sources | 8659 |
| clickhouse-scale | 13481 |
