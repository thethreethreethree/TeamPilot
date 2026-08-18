# CLOSURE — Macro Mode: Today's Metrics + Pitch Performance (2026-08-19)

**Status: COMPLETE + shipped.** Founder edit request (Macro Mode only) built in 5 phases, each gate-green +
guarded, committed incrementally (2c2cd1b → a84bf00e → 10bd0a33 → d19ae0a0 → e244d66b).

## What shipped
1. **Rubric** — pitch AI now grades the founder's five: objection / talk_listen / questions / tone / close
   (dropped opener). Prompt version v2. Flexible score schema → v1 pitches still validate.
2. **Data + API** — `getTodaysMetrics(repId, period)` + `GET /todays-metrics`; pure `period.ts`
   (windowing + score averaging), RLS-scoped, paged (no truncation).
3. **Today's Metrics UI** — Next-Door focus + KPI trio (Doors/Conversations/Sales) + Score Chart + Opportunities,
   with the Day/Week/Month/All-Time tabs. Honest error/empty.
4. **Pitch Performance** — Report Card renamed; tabs + pattern hero removed (moved to Today's Metrics); the
   recordings list shows each pitch's after-pitch summary inline + outcome.
5. **Macro home** — 3 cards (Door Log · Today's Metrics · Pitch Performance) per the wireframe; MacroModeToggle
   is now just the on/off switch.

## Founder decisions locked (AskUserQuestion, this session)
- Score Chart = the five dims per the spec (rubric changed to match — the fuller build).
- Next-Door focus = top growth opportunity, auto (non-stateful): the #1 recurring growth opportunity.

## Verification (§1.5.1 four layers)
- **Structure**: reused rep_kpi_daily / pitch_analyses / rep_pattern_summaries + the tested paginate primitive;
  one new component + route + API + pure helper module. No schema change (flexible score record).
- **Effectivity**: Score Chart averages REAL scores over analyzed pitches; every KPI real; a fetch error is
  honest, never a zeroed page.
- **Composition**: the 3 cards route to the 3 surfaces; tabs live on Today's Metrics only (no duplication with
  Pitch Performance); the "Start Knocking" CTA still goes to the Door Log.
- **Surface**: fixed-shell scroll idiom on every new surface; present-dims-only Score Chart (no phantom zeros).
- Guards: rubricDimensions / period / TodaysMetrics.render / ReportCard.render (updated) / macroCardVisibility
  (updated) / PitchDetail.render (label). Full `npm run check` green (3035 tests, 0 invariant violations).

## Residuals (R — noted, NOT blocking; founder to steer)
- **R1 — old pitches lack the 2 new dims.** talk_listen + questions only appear on pitches analyzed under v2.
  Existing pitches show objection/tone/close (+ their old opener) until re-analyzed. The Score Chart is honest
  (shows only present dims), but the full 5-bar chart populates as new pitches come in — OR a one-off re-analysis
  backfill of old pitches under v2 would fill them immediately. **Founder call: leave to fill forward, or backfill?**
- **R2 — desktop.** The wireframe is mobile; the desktop Macro experience (a Today's-Metrics sidebar entry / a
  desktop 3-card view) is not built. Desktop sidebar still only hides /sessions + /strategy when macroOn.
- **R3 — internal naming.** Component/route stay ReportCard//report-card (display "Pitch Performance") to avoid a
  PitchDetail path cascade; a pure rename is a safe later refactor.

## Outside-view (§1.3)
- *Rep*: home is now the 3 things they use; Today's Metrics gives a clear "work on THIS next" + their day's numbers.
- *Engineer*: pure helpers tested; DB wiring mirrors the existing KPI functions; no new schema/RLS surface.
- *Adversary*: RLS-scoped reads (rep sees own; manager may pass repId, still authorized); no new write path.
- *CFO*: no new LLM cost on view (rollup precomputed); the rubric change adds no per-pitch cost (same one call).
