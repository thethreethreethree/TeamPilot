# DeepSeek usage, real cost per pitch, and reasoning vs non-reasoning (2026-10-12)

Why this exists: the founder asked whether our token and cost estimates were too high, and for a pricing model
built on real usage. These are the measurements behind https://claude.ai/artifact/2TnJeJAK1YLvZaBa6ubQki.

## 1. What the DeepSeek bills show

Source: DeepSeek usage exports, key ARCH1 (EloState production), files `usage_data_2026-09-01_2026-09-30` and
`usage_data_2026-10-01_2026-10-01`.

| Period | Requests | Input tokens / request | Output tokens / request | Cost |
|---|---|---|---|---|
| 1 Oct, 04:00–23:00 (+08:00) | 4,848 | 6,243 | 2,433 | $11.24 |
| September | 10,490 | 4,335 | 2,085 | $21.57 |

- **1 October is not user activity.** The key made exactly 240 requests in every hour, 4 a minute, and no call
  was recorded that day; the newest call is 2026-09-28. This is the summary-refresh loop fixed on 2026-10-01
  (it re-wrote four rep summaries every minute). The bill is the bug.
- **September** has 8,571 of its 10,490 requests on 20–22 September, the same loop.
- **Real cost** is the 2026-10-03 measurement: 9 pitches re-run for $0.08, about $0.009 a pitch.

## 2. Real usage (production, read-only, 2026-10-12; sales calls, June–September, test accounts excluded)

- A call lasts 7.0 minutes on average (median 3.7, top 10% 11.5); its transcript averages 126 words.
- 2,895 AI outputs over 369 calls: about 7.8 per call, re-runs included.
- A rep's working day: 4.1 calls, about 0.34 hours of recorded talk. About 6.7 working days a month (Jul–Aug).
- Accounts: Align Sales Pros (8 seats, 6 active), Deeznuts (1), Caliber (1), ELOSTATE (internal, 10 seats).

## 3. Reasoning vs non-reasoning model, measured

Founder picker 2026-10-12: "Measure first". The real `analyzePitch` (same prompt, same `runBrainCall`
composition) ran on the 9 most recent door pitches under each model, with `DEEPSEEK_MODEL` switched between
runs. Read-only: nothing written to the database. The temporary test was deleted after the run.

| | deepseek-v4-flash (reasoning, today) | deepseek-chat (non-reasoning) |
|---|---|---|
| Output tokens per analysis | 1,357 (857 reasoning) | 405 |
| Input tokens per analysis | 1,536 | 1,511 |
| Time per analysis | 10.9 s | 4.8 s |
| Cost per analysis (full-price tier) | $0.00198 | $0.00087 |
| Completed | 9 of 9 | 9 of 9 |

Both responses reported the served model as `deepseek-flash`.

Scores per pitch (objection / talk_listen / questions / tone / close):

| Pitch | Words | Reasoning | Non-reasoning |
|---|---|---|---|
| afedb03b | 891 | 28 / 30 / 40 / 42 / 30 | 35 / 45 / 60 / 70 / 30 |
| df003f4a | 1,133 | 55 / 42 / 45 / 65 / 38 | 55 / 40 / 45 / 70 / 40 |
| 95272092 | 299 | 20 / 22 / 35 / 55 / 30 | 25 / 30 / 30 / 55 / 20 |
| 4ab23866 | 236 | 55 / 60 / 63 / 78 / 38 | 55 / 65 / 45 / 75 / 35 |
| 4e4a71c1 | 3,696 | 45 / 55 / 42 / 68 / 30 | 58 / 45 / 40 / 78 / 35 |
| 0a97fd4e | 39 | 45 / 35 / 25 / 55 / 25 | 0 / 0 / 0 / 0 / 0 |
| e8766e22 | 16 | 20 / 25 / 20 / 40 / 15 | 0 / 0 / 0 / 0 / 0 |
| 4c6c3c91 | 38 | 50 / 30 / 15 / 55 / 15 | 0 / 0 / 0 / 50 / 0 |
| 52e1aea4 | 78 | 85 / 85 / 45 / 88 / 60 | 78 / 85 / 40 / 82 / 55 |

Reading: close on real pitches; on near-empty recordings (16–39 words) the non-reasoning model scores 0 where
the reasoning model invents 15–55. No switch has been made; that is a founder decision.

## 4. What this changes in the cost model

- Answer tokens per request on our own (non-reasoning) model: **405, measured**, replacing the 400 estimate.
- Still estimates: speech transcription speed on our GPU, LLM throughput on our GPU, pod utilisation, hosting
  per user, support per rep. The voice build's P3-T01 benchmark measures the speech and LLM numbers once the
  field corpus exists.

Not opened: none.
