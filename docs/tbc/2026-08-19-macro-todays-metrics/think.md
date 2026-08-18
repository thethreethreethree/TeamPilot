# THINK — Macro Mode: Today's Metrics + Pitch Performance rename (2026-08-19)

**Trigger:** Founder edit request (2 images: text spec + wireframe), Macro Mode only.

## Document integrity (§0.1, A19)
`sha256sum` MATCH against `docs/tbc/DOC_MANIFEST.json`: CLAUDE.md `3325eedc…` (480 lines),
ThinkerThinker.md `19d6ff10…` (1068 lines). Methodology present in tree → proceed.

## Session-reads (§3.1.2, A22)
- **§0 / §0.1** (CLAUDE.md 1–70): understand before build; methodology in tree (verified above).
- **§1.5.1** (CLAUDE.md four-layer, ~95–150): evaluate structure → effectivity → composition → surface, in order.
- **§1.5.2** (proactive audit): THINK first, then build; audit adjacent surfaces.
- **§3.4** (no-instant-results / honesty): every number real; a fetch error is never dressed as empty.
- **§6 checklist 5a** (workflow continuity): the 3-card home must leave the rep in a flowing state.
- Founder decisions (this session, AskUserQuestion): Score Chart = the 5 dims per the spec (objection,
  talk_listen, questions, tone, close — DROP opener); Next Door focus = top growth opportunity, auto (non-stateful).

## The request (Macro Mode ONLY)
1. **Macro home → 3 cards**: Door Log · Today's Metrics (NEW) · Pitch Performance (renamed from "Report Card").
2. **Pitch Performance** = the recordings list (each pitch → after-pitch summary + outcome badge). Period tabs REMOVED.
3. **Today's Metrics** (NEW surface, GETS the Day/Week/Month/All-Time tabs):
   - "Next Door focus" (top) — the rep's #1 recurring growth opportunity, framed "work on this for your next 10 doors."
   - Doors Knocked · Conversations Had (= presentations: doors knocked − no-answer) · Sales.
   - Score Chart: Objection, Talk/Listen, Questions, Tone, Close (avg per dim across the period's analyzed pitches).
   - Opportunities to grow (the rollup's patternsBad).

## Four-layer evaluation (§1.5.1)
1. **Structure**: reuse the existing rollup (`rep_pattern_summaries`, per-period) for patterns/focus + `rep_kpi_daily`
   for doors/sales; add a per-period SCORE aggregation over `pitch_analyses.scores`. New `TodaysMetrics` component +
   route + one API endpoint. Pitch analysis rubric changes (analyze.ts) — the one data-model change.
2. **Effectivity**: the score chart shows REAL averages over analyzed pitches; old pitches (opener/objection/tone/
   close) simply won't have talk_listen/questions until re-analyzed — show only the dims present, honestly.
3. **Composition**: 3 cards route to the 3 surfaces; "Start Knocking" already goes to Door Log; the tabs live on
   Today's Metrics, not Pitch Performance (no duplication).
4. **Surface**: clean 3-card mobile home (wireframe), fixed-shell scroll idiom (flex-1 min-h-0 overflow-y-auto).

## Phases (build incrementally, commit each)
- **P1** — Rubric change: analyze.ts RUBRIC_DIMENSIONS + prompt → [objection, talk_listen, questions, tone, close].
- **P2** — Data: per-period KPI + score aggregation + focus (top growth opp) → a `todays-metrics` API.
- **P3** — TodaysMetrics component + route.
- **P4** — Rename Report Card → Pitch Performance (component + routes + links); strip period tabs; content = recordings.
- **P5** — Macro home: 3 cards (Door Log, Today's Metrics, Pitch Performance).

## Guards (each phase)
Node tests where pure (rubric dims, score aggregation, presentation math, focus selection); render tests for the
new surfaces (fixed-shell idiom + honest error/empty). `npm run check` green before closure.
