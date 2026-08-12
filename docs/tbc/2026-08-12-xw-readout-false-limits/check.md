# CHECK — readout false-limits

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — two readouts aggregate windowed events behind a fixed >1000-row cap (false bound → wrong numbers)
file+line: `admin/coach-readout/route.ts` (stepEvents/gradeEvents/analyzeEvents, `.limit(2000)`) ·
`brain/learning-summary/route.ts` (coachEvents, `.limit(2000)`).
class: false-limit truncation of a JS-side aggregation (the sweep's class). Past ~1000 events in the window the
counts silently undercount.
severity: medium (brain — user-facing section-3.6 surface) / low-medium (admin — founder diagnostic). Covered by
the founder's standing "fix the false limits" queue item.
sweep-command: `grep -rnE "\.limit\(\s*[0-9]{4,}\s*\)" src/app/api/admin/coach-readout src/app/api/brain` — after
the fix, no >1000 limit remains in either; the FALSE_LIMIT invariant + its self-cleaning check confirm the
allowlist now holds only the two genuinely-open sites (finance display UI, care.ts KEEP/REVERT).
remediation: page the four reads via fetchAllPaged (see remediate.md).

## Tests
No route test exists for either file (A30 honesty). The fetchAllPaged mechanism (>1000 paging + throw-on-error)
is covered by src/lib/supabase/__tests__/paginate.test.ts; the change is a mechanical read-shape swap that keeps
each route's §3.4 error combine byte-identical (confirmed by reading both combines).

## Full gate
```
PENDING — pasted in closure after the run
```
