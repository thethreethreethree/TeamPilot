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
