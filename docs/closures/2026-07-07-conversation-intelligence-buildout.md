# Closure — Conversation-intelligence buildout (the 5 partial/gap features)

Founder request (2026-07-07): build the 5 non-"Have" capabilities from the
competitor checklist. Decisions via AskUserQuestion: score dimensions on **both
surfaces** (After Pitch + summary), competitor detection **LLM-generic**,
observations **manager-visible** (scores stay owner-private, §A18). Stated
defaults (accepted): question-frequency **computed count**, next-step **graded
0–10**, sentiment **per-moment tags on the timeline**, topics **3–5 chips**.

## Session-read manifest (§A22)
Read from the working tree this session (2026-07-07), not cached labels:
CLAUDE.md (in session context); ThinkerThinker.md in full (A1–A22); AMD-006 in
full (parent + 3 addenda). Code re-read before editing: salesScore.ts +
salesScorePrompt.ts, salesMoments.ts + salesMomentsPrompt.ts, summaryTypes.ts,
the summarize + finalize routes, PivotAndScores.tsx, SessionCoachTools.tsx, the
session page, and the After Pitch page's Scoreboard.

## What was built (file by file)

**Scores — 2 new dimensions (shared engine → both After Pitch AND summary, §A21):**
- `summaryTypes.ts` — `ScoreKey` += `question_rate`, `next_step`.
- `salesScore.ts` — `computeQuestionRate` (deterministic COUNT, §A11 mirror — like
  talk_ratio, not a grade); wired into `generateSalesScores` + `orderCategories`
  (7-key order); `parseGraded` now accepts `next_step`. `isQuestion` helper.
- `salesScorePrompt.ts` — grades FIVE categories now (adds `next_step`, defined as
  distinct from `close`).

**Sentiment — continuous arc on the timeline (§A16, folds into moments, no new call):**
- `summaryTypes.ts` — `SalesMoment.sentiment?: "warming"|"cooling"|"neutral"`.
- `salesMomentsPrompt.ts` — asks for per-moment customer sentiment.
- `salesMoments.ts` — `parseMoments` parses sentiment (unknown/absent → "neutral").

**Conversation intelligence — competitors + topics (new engine, 1 LLM call):**
- `salesIntelPrompt.ts` + `salesIntel.ts` (NEW) — `generateSalesIntel` +
  `parseIntel` (strings, trimmed, deduped, bounded, §3.4 empty-honest) +
  `runAndStoreIntel` → append-only `coach.session_intel_generated` event
  (manager-visible, founder decision).

**Wiring:** summarize route POST composes summary+moments+pivot+**intel** and GET
reads all four back; finalize generates intel post-call too (§1.5.1 continuity).

**UI:** `PivotAndScores.tsx` — new `IntelSection` (competitor + topic chips,
manager-visible), per-moment sentiment arrow on the timeline, score grid 5→7
(grid-cols-4). Both surfaces pass `intel`. After Pitch Scoreboard grid 5→7 for
parity (§A21). Tests: `salesIntel.test.ts` (7), question-rate + next_step + moment
sentiment (5) — 362 pass total.

## Framework mapping
- **§A11** — question-rate is a COUNT surfaced with a neutral read (not a good/bad
  verdict); intel is extraction (facts), not judgment; graded scores keep the
  rationale+citation contract.
- **§A18** — the two new SCORES ride the owner-only `/summary-scores` gate
  unchanged (manager still gets 403); the new OBSERVATIONS (competitors, topics,
  sentiment) are manager-visible per your decision, stored in the manager-readable
  events stream, consistent with the pivot/timeline.
- **§A21** — score dimensions added to the SHARED engine so After Pitch and the
  summary show one consistent rubric (both grids updated).
- **§A16** — sentiment folded into the existing moments call; intel is one added
  call, not three (competitors+topics combined) — bounding the finalize budget.
- **§A13** — new shapes live in `summaryTypes.ts`, imported by engine + client.
- **AMD-006 L1–L4** — reused engines/patterns (L1); delivers the competitor
  capabilities end-to-end (L2); composes onto the existing surfaces (L3); matches
  the existing chip/score visual language (L4).

## Verified
typecheck + lint + theme:audit + rls:audit + **362 tests** pass; production build
clean. New parse/compute logic is unit-tested (12 new tests).

## UNTESTED (honest, per your terms)
- **LLM output quality** — no live model call: whether the intel engine names the
  right competitors/topics, the sentiment read is accurate, and the next_step
  grade is fair is UNTESTED. Only the parse/compute logic is unit-tested.
- **Browser render** of the new intel section, the 7-tile grid (both surfaces),
  and the sentiment arrows — read-verified only, not viewed. UNTESTED.
- **finalize now fires 5 LLM calls** (dissect+summary+moments+pivot+intel) under
  keepalive — my prior audit finding 4 (timeout risk on long calls) is now larger.
  Still HELD for your architecture decision.

## Nothing changed from your spec
Built as specified with your three decisions + the stated defaults. No silent
substitutions. The two audit items still HELD for your call: finding 2 (moments
cross-surface divergence) and finding 4 (finalize budget — now 5 calls).
