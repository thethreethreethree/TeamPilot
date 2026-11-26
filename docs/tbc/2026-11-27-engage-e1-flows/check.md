# CHECK - Engage E1: flows, enrolments, today's steps

## Commands

```
npm run db:verify → 0377 ok (rolled back)
probe p0377.mjs (production, rolled back, codes and counts only):
  contact email ok, bad email 23514, phone ok
  bad flow step 23514; an enrolment with the wrong rep P0001; the same person twice 23505; editing a flow P0001
  erasure: engage_notes_blanked 1, notes left 0, email/phone left 0
npx vitest run src/app/api/coach/remote/engage → 4 passed (exit 0)
npx vitest run src/lib/coach/remote src/components/remote-sales src/app/api/coach/remote → 173 files passed (exit 0)
tsc clean · theme / rls / invariant / reachability / writer audits ✓
npm run check → gates the commit
```

## Findings

### F1 - contacts had no email or phone to reach
class: a feature whose input didn't exist (A31's seam).
sweep: 0377 adds them, with erasure and the contact search.
severity: high (email and call steps couldn't work without them).

### F2 - a route returned an error's message
class: CWE-209 (the audit's rule).
sweep: the enrolments route (fixed sentences by state).
severity: low.
