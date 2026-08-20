# Build — colour-coded export + custom schedule name

## Features (inventory + A31 reachability — both directions of every seam)

### Colour-coded schedule export
- files: src/lib/schedule/shiftColors.ts, src/app/dashboard/schedule/grid/page.tsx (renderCanvas)
- write-path: EXISTS — the manager triggers it from the Grid's Print / Download / Print-all / Download-all
  buttons, which both call the single `renderCanvas`; the data written is the derived schedule itself (shifts →
  deriveState), no new input surface. human_can_set: true.
- read-path: EXISTS — `renderCanvas` draws colour-coded pills (`bandFromLabel` → `BAND_STYLE`), a legend, header
  band and weekend tint to a PNG the manager downloads/prints; confirmed by eye via a headless render + Read of
  the PNG (check.md). No migration required — ships on deploy. human_can_see: true.

### Custom schedule name
- files: supabase/migrations/0234_companies_schedule_name.sql, src/lib/schedule/settings.ts,
  src/app/api/schedule/settings/route.ts, src/app/dashboard/schedule/settings/page.tsx
- write-path: EXISTS — the manager types it in the Settings "Schedule name" input; `PATCH /api/schedule/settings`
  persists `companies.schedule_name` (company_id pinned to the session — INV15). Depends on migration 0234 being
  applied (flagged — §1.5.3/A41); until then the write returns 500 and the export falls back to the company name.
  human_can_set: true.
- read-path: EXISTS — `GET /api/schedule/settings` → `getScheduleSettings` returns `scheduleName` → the grid
  render titles the export with it (or the company name when null). human_can_see: true.

### Guarded settings read (pre-migration safety)
- files: src/lib/schedule/settings.ts (getScheduleSettings)
- write-path: EXISTS — same PATCH as above is the only writer; the guard concerns the READ, so no separate write.
  human_can_set: true (via the custom-name write).
- read-path: EXISTS — `getScheduleSettings` selects `schedule_name` with the missing-column guard extended, so a
  pre-0234 DB returns defaults (name=null → company name) instead of crashing; every schedule surface that loads
  settings goes through this one reader. human_can_see: true.

## Files
- `src/lib/schedule/shiftColors.ts` (NEW) — pure time-of-day band classification + palette. `bandOf`,
  `bandFromLabel`, `BAND_STYLE`, `WORKED_BANDS`. No React, no canvas — verifiable in isolation.
- `src/lib/schedule/__tests__/shiftColors.test.ts` (NEW) — pins the classification (start-hour boundaries,
  midnight-crossing → overnight, malformed label → null), distinct fills, band order.
- `supabase/migrations/0234_companies_schedule_name.sql` (NEW) — `add column if not exists schedule_name text`
  nullable, CHECK ≤ 60 chars. Additive, safe-to-re-run.
- `src/lib/schedule/settings.ts` — `ScheduleSettings.scheduleName`, `normalizeScheduleName` (trim/cap/blank→null),
  read `schedule_name` with the missing-column guard extended to it (A34).
- `src/app/api/schedule/settings/route.ts` — Body accepts `scheduleName`; PATCH persists `schedule_name`
  (company_id pinned to the session — INV15); GET returns it.
- `src/app/dashboard/schedule/settings/page.tsx` — a "Schedule name" text input (blank = company name).
- `src/app/dashboard/schedule/grid/page.tsx` — `renderCanvas` redesigned: brand header band with the custom
  title (`settings.scheduleName?.trim() || companyName`), colour legend, weekend-tinted columns, colour-coded
  rounded shift pills, time-off in rose. The canvas-too-large fail-loud guard is preserved.

## Reachability (A31 — the seam that turns code into a feature)
- Read seam: grid page already fetches `/api/schedule/settings` into `settings`; `scheduleName` now flows
  through GET → state → the render title. Verified by the field being in the GET response shape.
- Write seam: settings page `save()` already POSTs the whole `settings` object; the Body schema now accepts
  `scheduleName`, and the PATCH writes `schedule_name`. Depends on 0234 (flagged).
- Render seam: Print + Download both call the one `renderCanvas`; the redesign lands on both at once.

## Decisions
- Colour by START hour (morning <11, day 11-14, evening 15-19, overnight ≥20 or <5 or crosses-midnight). A
  midnight-crossing shift is overnight regardless of start. Chosen so AM-start shifts share a hue (visual
  consistency) and graveyard reads as night.
- Custom name on the companies row (not an event): it is display chrome, not schedule state, so it does not
  belong in the append-only event log (§3.1) — it mirrors timezone/workweek_start, the existing display/setting
  precedent (A28 — reuse the established pattern rather than invent a parallel one).
