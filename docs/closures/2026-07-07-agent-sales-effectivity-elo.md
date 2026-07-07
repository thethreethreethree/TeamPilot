# Closure — Agent Sales Effectivity Rating (ELO vs. the standard)

Founder request (2026-07-07): an ELO-style Agent Sales Effectivity Rating —
each conversation is a "game" the rep plays against OUR measurement standard
(not against other reps), composed of conversation quality (Dissect/review),
conversation rating (after-pitch scores), and outcome. Decisions via
AskUserQuestion: **rep sees their own** (growth-framed, §A10) + managers/admins
see it; **balanced** outcome/process; **fixed 1500** opponent.

## Session-read manifest (§A22)
CLAUDE.md (session context); ThinkerThinker.md in full this session (A1–A22).
Read before editing: after_pitch_summaries payload shape (scores + narrative),
coaching_sessions (outcome/ended_at), team-analytics manager-check pattern, the
coach-assessment + analytics pages.

## What was built (file by file)
- `salesElo.ts` (NEW) — pure ELO engine: `outcomeValue`, `gameScoreFromFactors`
  (balanced: 0.5 outcome + 0.5 performance, where performance = after-pitch score
  mean + review strengths/growth quality), `expectedScore`, `updateElo` (K=24 vs
  fixed 1500), `computeAgentElo` (replay from 1500, provisional < 5 games). Plus
  `getAgentEloGames` / `getAgentEloRating` — fetch the agent's after-pitch data
  (rating + quality) joined with the session outcome, via admin (route-gated).
- `salesElo.test.ts` (NEW) — 16 tests pin the math + the non-game exclusions.
- `/api/coach/sales-session/elo/route.ts` (NEW) — GET ?agentId. §A10/§A18 access:
  rep may read their OWN; a same-company manager/admin may read a rep's; peers
  cannot. Returns ONE agent's curve, never a ranked list.
- `AgentEloBadge.tsx` (NEW) — growth-framed badge ("you vs. the standard 1500,
  not other reps"), trend delta, provisional flag. Fails quiet on error.
- `coach-assessment/page.tsx` — badge on each agent card (manager view); **order
  stays ALPHABETICAL, never sorted by rating** (the anti-leaderboard mitigation).
- `analytics/page.tsx` — `<AgentEloBadge self />` (the rep's OWN rating, §A10).

## Framework mapping
- **§A10** — the rep sees their own rating on their Analytics page (no shadow read).
- **§A11 / §A18** — framed as growth-vs-a-standard, not a rank; provisional flag;
  and the manager page is NOT sortable by rating (alphabetical) so it doesn't
  become the leaderboard the page's own principle refuses.
- **§3.5** — outcome (consequence) is half the game score; process the other half.
- **§4** — a NEW measurement method: ships PROVISIONAL (< 5 games flagged), to be
  validated against an alternative before trusted.
- **§3.1** — reads the append-only after-pitch + outcome events (compute-on-read;
  no new write path this increment).

## Verified
typecheck + lint + theme:audit + rls:audit + 378 tests (16 new); build clean.

## UNTESTED (honest)
- The ELO MATH is unit-tested; the end-to-end (real after-pitch + outcome data →
  route → badge render) is UNTESTED live. No real sessions were run through it.
- The `getAgentEloGames` DB join (after_pitch_summaries + coaching_sessions) is
  read-verified only — untested against real rows.

## Flagged (§A20 — surfaced, not silently resolved)
- **Residual §A11/§A18 tension:** the coach-assessment page shows multiple agents'
  ratings on one screen — even alphabetical + "vs standard," a manager CAN eyeball
  a comparison. I kept the strongest mitigations (no rating sort, growth framing,
  provisional). If you'd rather, the manager view could show the rating only on an
  individual agent's drill-down (not the roster) to remove the side-by-side.
- **Compute-on-read:** ratings recompute per view (fine for small teams). At scale,
  store per-session ELO deltas as events. Deferred.
- **Weighting/curve constants** (K=24, outcome map sold=1/follow_up=.7/no_sale=.35,
  1500 opponent) are the §4 knobs — tune once real data accrues.

## Math audit + solidification (2026-07-07, founder-directed)

Re-read the actual `salesElo.ts` and audited the math. Two real findings fixed:

- **A [MED-HIGH] §3.5** — `meanScore01` averaged the COMPUTED categories
  (talk_ratio, question_rate) whose `.score` is a share-proxy for uniform strip
  rendering, NOT a 0-10 quality grade — so a balanced 50/50 talk ratio (good) read
  as ~5/10 and dragged performance down. FIXED: the quality mean now averages only
  the GRADED (`!computed`) categories; a session with no graded score is skipped
  (§3.4). Class-checked: no other code averages `.score` — isolated to the ELO.
- **B [MED] §3.5 + founder** — the rating was unbounded. FIXED: clamp to
  **[100, 3000]** — 3000 is the chess max (founder), 100 the floor. Practical band
  vs the 1500 standard is ~1000-1900; 3000 is the theoretical ceiling as in chess.
- **C [LOW] §4** — the constants (K, outcome map, opponent) remain unvalidated
  knobs; correctly ships provisional. No change.

Also (§A18 exposure discipline): the `/elo` route now returns the per-session
`history` (each game's derived score) ONLY to the OWNER; a manager gets rating +
gamesPlayed + provisional + the latest trend delta, never the per-session
breakdown of the rep's private scores.

Tests: +4 (computed-exclusion ×2, clamp ceiling/floor ×2) — 20 ELO tests, 382
total. Gate + build clean. STILL UNTESTED live: the end-to-end with real data.

## Source from existing dissected calls (2026-07-07, founder-directed)

**L2 effectivity gap (AMD-006):** the badge read "needs a scored call with an
outcome" even for reps with 10–11 dissected sessions — because the engine sourced
games ONLY from `after_pitch_summaries`, which those older dissected sessions
lack. Decisions (AskUserQuestion): source from the **existing Dissect** (no new
LLM calls) and **count sessions with no recorded outcome on process/quality
alone**. Built:
- `getAgentEloGames` now sources from `coach.dissect_generated` events (actor =
  agent, subject = session) for the quality signal (strengths vs growth), joins
  the after-pitch SCORES where they exist (the numeric rating), and the session
  outcome. A session is a game if it has EITHER a dissect quality signal OR
  after-pitch scores.
- `gameScoreFromFactors`: performance now composes from scores and/or dissect
  quality (whichever exist); when an outcome was recorded it's half the game
  (§3.5), otherwise the session counts on process/quality alone (founder's
  relaxation — a deliberate drop of the outcome anchor for un-logged calls, so the
  back-catalogue rates). `no_contact` is still never a game; no-signal-at-all is
  skipped (§3.2/§3.4).
- Badge empty copy → "needs a dissected call to start".

Framework note: this trades §3.5 strictness (outcome-anchored) for AMD-006 L2
(the feature actually delivers on real data) — the founder's explicit call, on
the record. Tests updated (+2 net) — 22 ELO / 384 total; gate + build clean.
UNTESTED live: the dissect→session→outcome join against real rows.
