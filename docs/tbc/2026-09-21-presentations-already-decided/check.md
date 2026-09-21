# CHECK

## Commands run, by the project's own names

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` | clean |
| `npm run invariant:audit` | **0 violations** |
| `npm run reachability:audit` | **0 unreachable** |
| `npx vitest run` | **4,693 passed**, 15 skipped |

## The decision was verified, not taken on trust

The docblock in `doorlog.ts` announces the founder's decision. Announcements are what A38 says
not to accept, so both implementations were read:

- `getAllTimeKpi` — `presentations: Math.max(0, doorsKnocked - noAnswer)`
- `getTodaysMetrics` — its docblock: *"conversations = presentations = doors spoken to in the
  window, founder 2026-09-11"*

Two functions, one definition, matching the docblock. The claim holds.

## Three tests changed, and why each had to

| Test | Why it broke |
|---|---|
| `matches the team activity row: 671 / 98 / 20` | passed `recordedPitches: 98`; now `doorsSpokenTo: 98`. **The expected numbers did not change** — the mockup row reports presentations, whatever produces them. |
| `returns null, not 0%, when the denominator is empty` | signature only |
| `rep totals sum to team totals` | its `kpis()` helper passed the old field, producing `NaN` |

The first is worth dwelling on: the corrected definition produces the **same** team row the
mockups show. The old default was not visibly wrong on the mockup data — it was wrong on the
founder's real data, which is precisely why it survived being written down.

A fourth test was added, reproducing the 333% close rate under the old default.

## What is NOT verified

- **No real KPI has been computed.** The three exports still have no caller; `rep_kpi_daily` has
  never been read by this code path.
- **The correction is asserted against the founder's quoted numbers**, taken from the `doorlog.ts`
  docblock — 126 vs 50, and 18/3/10. They were not re-measured against production.
- **Nothing renders these KPIs yet**, so no screen currently shows either definition. The
  correction landed before the surface, which is the only reason this is a code change rather
  than an incident.
