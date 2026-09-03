# Gamification — Resolved Decisions

Founder decisions (2026-09-03), after Phase-0 FINDINGS. These override the plan's blank OPEN-DECISIONS where they
conflict, because Phase 0 found an existing scoring system the plan didn't know about.

## ★ ARCHITECTURE (new decision, from FINDINGS 16) — REUSE existing scores
Points are derived from the **existing after-pitch scores** (`after_pitch_summaries.payload.scores`, produced by
`src/lib/coach/v5/salesScore.ts`), NOT a new LLM judge. Consequences:
- **No `session_scores` table + no new judge** (Phase 2 of the plan is mostly obviated). The score source of truth
  stays the after-pitch summary (rep-private).
- Phase 2 becomes: a pure **points mapping** from the existing dimension scores → a banked points total, written to
  the ledger. The five rubric dimensions map to existing ones (Value Framing has no existing equivalent — deferred).
- Avoids duplicate STT+LLM cost and a second divergent score (2.2 single-source).

## ★★ PRIVACY (new decision, from FINDINGS I-9 / A18) — GAMIFY WITHIN PRIVACY
The leaderboard shows **rank + total points + deals** to the team (the competitive/motivational layer), but each
rep's **per-session dimension detail stays rep-private** (owner + their managers only). This preserves the ratified
A18 rep-privacy model. Consequences for Phase 1 RLS:
- The point **ledger rows** are readable by the owning agent + company managers (role in CEO/COO/admin OR
  sales_coach_role='admin'), NOT by peers.
- The **leaderboard** (Phase 5) reads from an aggregate that exposes per-agent rank + SUM(points) + deal count
  **company-wide to all company members**, WITHOUT per-session detail. (Phase 1 notes this; Phase 5 builds the view.)
- Resolves **D12** (agents see aggregates/rank, not each other's per-session detail).

## D4 — Scoreboard primary sort: POINTS primary, deals as a column.
Tie-break: higher average points, then fewer sessions (so volume alone doesn't win).

## D1 — Score ceiling (derived from the REUSE decision)
Since points reuse the existing dimension scores (0–10 each), the banked points per session =
**round(mean of the session's scored dimensions × 10) → a 0–100 scale** ("you ran that one at 72/100"). Intuitive,
tunable via one config constant. The manager-alert "strong session" threshold = **80** (the 80% band the founder
described). Both live in one config object, not scattered literals.

## D15 / D13 — Agent feedback view: LARGELY ALREADY EXISTS
The after-pitch review already IS the agent's per-session feedback view (dimension scores + citations + coaching
notes). Phase 5's "agent's own view" should LINK to / reuse it, not rebuild it. The new agent-facing piece is a
**points/rank trend**, not a second score breakdown.

## Deferred (v1 = not built), unchanged from the plan
D2 (deal bonus), D3 (per-channel weights), D5–D7 (low-score/streak/digest alerts), D8 (poor-transcript handling),
D9–D11 (anti-gaming: daily cap / manager override / dedupe), D14 (retroactive scoring — though 152 already-scored
sessions could seed the board cheaply; revisit), D6 streaks.

## Facts (not decisions) carried from FINDINGS
- **Channels:** only `in_person` (→ door_to_door) and `video` (→ video_call). No voice_call.
- **"Deal closed" = `coaching_sessions.outcome = 'sold'`** (the LIVE value). Do NOT key on 'won' — migration 0205's
  won/lost enum change was a no-op (FINDINGS I-10); gamification keys on the real 'sold' value and does not touch
  the pre-existing enum mismatch (flagged for a separate fix).
- **Manager = company admins** (no per-agent FK); notifications fan out to all company admins/sales-coach admins.
- **Control gate:** the points mapping is deterministic (no LLM), so 3.4 month-1 suppression does not apply to the
  ledger write; it only affects whether the underlying after-pitch score exists.
