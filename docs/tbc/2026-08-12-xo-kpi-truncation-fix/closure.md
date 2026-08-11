# CLOSURE — KPI truncation fix

## What shipped
The `kpi/me` and `kpi/team` routes now page all seven of their usage-growth reads (`after_pitch_summaries`,
`coaching_cues`, `coaching_cue_outcomes`, `coaching_transcript_segments`) via `fetchAllPaged` + `.order("id")`,
instead of a bare unbounded `.select()` capped at 1000 rows. This fixes the §3.5 Reliance Reduction headline
metric + cueAcceptanceRate + the Layer-3 quality metrics, which were computed over a truncated (wrong) session
set for any rep past ~25-30 coached sessions — most active reps — in both the rep and manager views. Founder-
authorized (AskUserQuestion 2026-08-12: "Fix it now"). Behaviour-preserving except the truncation.

## Un-named reliances (A35)
- **All four tables have a uuid `id` PK.** Range paging correctness needs a unique, stable sort key; verified
  `id uuid primary key` in migrations 0070 (segments, cues) + 0080 (cue_outcomes, after_pitch_summaries).
- **fetchAllPaged's paging is already unit-tested.** This build's test locks that the routes USE it (source
  guard); the paging loop itself is proven in paginate.test.ts, so the two together cover behaviour + wiring.
- **Error handling preserved deliberately.** The reads keep `.catch(() => null)` → `?? []`, matching the
  routes' pre-existing intent, so a transient read error degrades a metric to empty exactly as before — this
  fix changed truncation ONLY, not the swallow-vs-fail-loud policy (that is a separate, notable question — R2).

## Residual (A36 — ranked by confidence-it-does-not-matter; top OPENED)
```json
[
  { "id": "R1", "item": "A rep past ~1000 SESSIONS makes `sessionIds` itself a >1000-value `.in(\"session_id\", ...)` list on the cue/segment reads — a URL-length / PostgREST-limit concern the result-paging here does NOT solve.", "why_skipped": "It's a separate, rarer concern (needs >1000 lifetime sessions, vs the ~25-30 that triggers the fixed bug), explicitly flagged in fetchAllPaged's own doc; the correct fix is a server-side aggregate RPC (does the math in SQL, fetches nothing), a larger change than this founder-authorized truncation fix.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-12T07:20:00Z", "outcome": "Opened + assessed: confirmed the after_pitch reads (filtered by agent/member, small `.in`) are unaffected; only the cue/segment reads (filtered by sessionIds) hit it, and only past ~1000 sessions. Documented for a future server-side-aggregate-RPC pass; NOT bundled to keep this fix scoped to what the founder authorized. Surfaced." },
  { "id": "R2", "item": "The cue/segment reads still SWALLOW a read error into an empty result (`.catch(() => null)` → `?? []`), so a transient DB error silently degrades the headline reliance metric to a wrong-looking value rather than failing loud.", "why_skipped": "Pre-existing behaviour, deliberately preserved to keep this fix scoped to truncation; but for a HEADLINE honesty metric, fail-loud (or an explicit 'unavailable' state) is arguably more correct than a silent degrade. A separate §3.4 call.", "confidence_it_does_not_matter": "low", "opened_at": null }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest (13) · artifacts · residual (2) · freshness all ✓
test ✓ — Test Files 396 passed | 1 skipped (397); Tests 2731 passed | 15 skipped (2746)
CHECK_EXIT=0
```
