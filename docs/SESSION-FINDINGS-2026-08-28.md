# Session findings — 2026-08-28

A single long autonomous-build session. Two founder threads: (1) the KPI Analytics task
(accuracy + build the unbuilt metrics), and (2) a new "Role Play from a recorded pitch"
feature. Everything requested was delivered.

## Shipped (commits, newest last)

| Commit | What |
|---|---|
| `e0e01f4` | Coach Assessment feeds door pitches into the coaching content (stale-data fix) |
| `764f06d` | Analytics merged into the Coach Assessment card, per rep |
| `b2724ee7` | **KPI accuracy**: "presentations" = recorded pitches, not `knocked − no_answer` (Moses 46→41, verified live) |
| `62640048` | **Objections per session** + resolution rate — a real whole-call tally the after-pitch pass now emits |
| `e00f8028` | **Recommendation uptake** — direction-aware (talk_ratio down = uptake, question_rate up = uptake) |
| `f19339d5` | The 2 uncomputable tiles read "needs prospect tracking", not a false "building" |
| `88074562` | Objections + Uptake surfaced per-rep on the manager roster (aggregate-only, A18 privacy) |
| `984e9ec6` | **Follow-up rate + Sales cycle** from the existing `client_label` (96% populated, reused) — no new capture |
| `8d9d005d` | Roster parity: Follow-up + Sales cycle on the manager view too |
| `df26e8d7` | **Role Play from a recorded pitch** — reconstruct the customer + objections, scored on the weak spot |
| `227a4ab3` | **Dedup fix**: KPI reads take the latest after-pitch summary per session (fixes a Layer-3 double-count) |
| `363fa773` | Test coverage for the from-pitch route (404 privacy / null-transcript / focus) |
| `e9517f47` | On-record objection-tally backfill script (§3.1) |

Result: the KPI Analytics page has a real value or an honest "building" on **every** tile —
nothing blocked, nothing fabricated — on both the rep `/me` view and the manager roster.

## Key diagnoses (for future work)

- **Two separate KPI systems** — the door-Macro KPI (`doorlog.ts`, over `door_knocks`/`pitches`) and the session
  KPI (`compute.ts`, over `coaching_sessions`/`after_pitch_summaries`). Don't conflate. `presentations` is a
  door-Macro number = recorded pitches.
- **`after_pitch_summaries` is append-only** (a DB rule blocks UPDATE; migration 0080: "latest by created_at is
  current"). Every consumer must dedup to latest-per-session — `salesElo`, `strategy-library`, `dissectBackfill`,
  the `salesCoach` getters all already did; the KPI reads were the outlier, now fixed (`latestSummaryPerSession`).
- **Recommendation-uptake direction trap** — the two flaggable score dimensions improve in OPPOSITE directions;
  a naive "score went up = uptake" would have shipped inverted. Encoded in `FOCUS_IMPROVEMENT_DIR`.
- **Reasoning-model starvation** in the backfill — DeepSeek v4 burns tokens on reasoning before content;
  max_tokens 7500 + a 4500-char transcript slice were needed so the tiny tally answer wasn't truncated.

## Objection backfill (run 2026-08-28)

One-time, founder-approved. Per session: 1 focused LLM call tallies objections, MERGED into the session's latest
payload (scores/moments preserved), appended as a new summary. Additive + safe — verified the merge kept scores on
every row (0 broken) and that the +131 rows disrupt no consumer (all dedup to latest). Script on-record at
`scripts/backfill-objection-tally.mjs` (dry-run by default).

## Open decisions / residuals (founder's call)

1. **KPI snapshot cron does not persist the 4 new metrics.** `compute-cron` loads only session rows and computes
   Layer-1/2 session metrics — it does NOT load after-pitch payloads or `client_label`, so Objections / Uptake /
   Follow-up / Sales-cycle are computed **on-read** (rep view + roster, both working) but are **absent from
   `kpi_snapshot` history and any future email digest**. No consumer needs them today (digests are deferred), so
   this was NOT built — extend the cron if/when historical trends or digests should include them.
2. **Role Play reconstruction quality** over a real non-diarized pitch is founder visual-verify (an LLM judgement).
   If personas come out thin, switch the doorlog worker to the diarized STT (`transcribeSpeechDiarized`, already
   used by the Live coach) for clean rep/customer separation.
3. **Deploy verification** — could not confirm the Vercel deploy from the agent environment (`gh` unavailable, no
   prod URL in-repo). Confirm the commits deployed green in the Vercel dashboard.
