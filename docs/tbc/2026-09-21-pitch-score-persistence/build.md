# BUILD

## Files

**`supabase/migrations/0254_pitch_score_verdicts.sql`** (new)

- `pitches.section_points jsonb` — the scorer's per-section verdict, post-scaling, summing to
  `base`. jsonb rather than six columns because the sections are rubric config and a rubric
  revision that adds one must not need a migration.
- `pitch_events_type_check` widened to `('bonus', 'violation', 'rejected_bonus')`.
- `drop function` on the **old 19-argument signature**, then create the 20-argument one. This is
  the non-obvious part: `create or replace function` with a different parameter list creates a
  *second* overload rather than replacing the first, and a newly created function defaults to
  `EXECUTE` for `public` — so the old one would have kept working AND quietly undone 0253's
  INVARIANT 4 revoke. Verified: exactly one overload afterwards, and both roles false.

**`src/lib/coach/pitchScore/scorePitch.ts`** (modified)

- New `ScoredElement` type and `elementBreakdown` on the return. The authority on what counted.
  `points` is raw rubric weight, deliberately — `sectionPoints` carries the scaled figure.
- Duplicate guard: first grade wins for a repeated element id.

**`src/lib/coach/pitchScore/storePitchScore.ts`** (new)

- Maps verdicts to rows and joins the model's timestamp/evidence onto them by id. It decides
  nothing.
- `bandFor(total)` — display band. The thresholds are an **assumption**, stated as one in the
  source: the only evidence is the mockups showing "Strong" beside 80.3 and "Solid" beside 77.0,
  which pins one boundary between those two numbers and leaves the rest inferred.
- Returns `string | null`. Null is FAILURE, never "stored an empty pitch". Three failure paths,
  each logged: no honoured elements (refused before the round trip), RPC error, and a non-error
  reply that is not an id.
- The RPC error message is logged, not returned (CWE-209 — constraint text names columns).

**`src/lib/coach/pitchScore/__tests__/storePitchScore.test.ts`** (new, 22 tests)

## The decision that took the longest

What `points` means on an element row when Delivery is scaled.

- **Store the scaled value** — element rows sum to the section total, but every individual row
  lies: `Tonality 3.9` against a 3-point element.
- **Store the raw value and re-sum on read** — each row reads true, but no reader can reproduce
  `base`, which is exactly the defect being fixed.
- **Store the raw value and store the section verdict** — chosen. Each row reads true, `base`
  reconciles, and the scale factor is visible as `delivery_scaled` so the UI can explain the gap
  rather than hide it.

## Not built

No route calls `storePitchScore`. Project 1 needs one more piece — the scoring trigger — and it
is the next build, not this one. Stated in check.md rather than left to be discovered.
