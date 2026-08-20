# Closure

## What shipped
The schedule export now delivers the founder's specified experience: colour-coded shift pills by time of day, a
legend, a branded header with a **custom schedule name**, weekend tinting — verified by eye. The custom name is
stored on `companies.schedule_name` (migration 0234), read with a guarded fallback so it degrades to the company
name pre-migration.

## Residual (A36 — ranked; written as work, not a disclaimer)
```json
{ "id": "R1", "item": "BLOCKING for the custom-name WRITE: migration 0234 (companies.schedule_name) must be applied in prod — db:apply could not reach the DB from this environment.",
  "why_skipped": "External precondition the code cannot satisfy (§1.5.3/A41); the DB was unreachable here ('COULD NOT CONNECT: timeout').",
  "confidence_it_does_not_matter": "low",
  "opened_at": "2026-08-20T14:05:00Z",
  "outcome": "OPEN + FLAGGED to the founder as a blocking setup step. The READ degrades safely (guarded fallback → company name), so the colour-coded export is unaffected until a custom name is set; only saving a name 500s until 0234 is applied." }
```
```json
{ "id": "R2", "item": "Band boundary: a 09:00-start shift classifies as 'morning' (amber), not 'daytime' (blue), because the morning/day cutoff is hour 11.",
  "why_skipped": "A judgment call — grouping all AM-start shifts under one hue reads consistently; the founder may prefer 9-to-6 as daytime.",
  "confidence_it_does_not_matter": "medium",
  "opened_at": null,
  "outcome": "Left as-is; one-line change (cutoff 11→9 in shiftColors.ts + test) if the founder wants it." }
```
```json
{ "id": "R3", "item": "Export is PNG-per-image with the ~30k-px fail-loud guard; a very large multi-week 'all' export asks the manager to go week-by-week.",
  "why_skipped": "Pre-existing behavior, unchanged by this build; the UI already messages the fallback.",
  "confidence_it_does_not_matter": "high",
  "opened_at": "2026-08-20T14:20:00Z",
  "outcome": "OPENED + confirmed acceptable, with a real catch. The redesign INCREASED the per-week height (rowH 40→42, headH+titleH, header band + legend added), so the ~30k-px canvas cap is hit SOONER than before — the 'all' export of a many-week schedule falls back to week-by-week at a smaller week count now. Verified the guard still fires: `if (h * scale > 30000) return null` is intact and the callers show `tooLargeMsg` (fail-loud, not a blank image). Not a defect (correctness preserved; the fallback is visible), but the reduced ceiling is the honest cost of the taller design — logged so a multi-page PDF is the known next step if the founder hits it." }
```

## The un-named reliance (A20/A35 — what I leaned on without stating)
- I relied on the standalone repro being a faithful proxy for the in-app canvas. It uses the SAME palette +
  layout math, but it is not the app itself — a divergence between the repro and the component would not be
  caught. Mitigation: the palette + classification are imported from the same `shiftColors.ts` in the real code
  and locked by tests; only the drawing calls are duplicated in the repro.
- I relied on `roundRect` being present in the deploy target's browsers (guarded with a rect fallback, but the
  fallback is untested visually).

## Constitutional bearing
This build is itself the remediation of A42/AMD-012: a user-specified experience delivered as the intended
result and verified visually, not deferred as polish.
