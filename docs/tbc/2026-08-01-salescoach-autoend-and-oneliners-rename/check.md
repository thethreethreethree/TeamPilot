# CHECK — Sales Coach auto-end (B) + One Liners rename (C)

## Audit of the build

- **B is idempotent + non-blocking (A30):** re-ending an already-ended session is a trigger no-op
  (`old.status='active'` guard + `ended_at is null` guard in 0070), so the real end time is never
  overwritten; the end PATCH is wrapped in try/catch and the redirect happens regardless, so a transient
  failure never traps the rep on a dead screen.
- **B closes a measurement gap (§3.5):** a never-ended session left `ended_at` null → no duration → the
  avgSessionDuration KPI silently read nothing for that session. Auto-end stamps it.
- **C is minimal + link-safe:** route path `/strategy` unchanged (no broken bookmarks); only visible labels
  moved. Removed the orphaned `useExperienceMode` import so the title constant leaves no dead binding.

## Findings (class sweep — A26)

- Searched for any test or sibling asserting the old nav label `"Strategy"` or title `"Strategy Library"` →
  **none** (grep over `src/**/*.test.*` + the sales-coach home/components returned nothing), so the rename
  breaks no assertion.
- Both recording-complete callbacks (`onLabeled`, `onRecordingSaved`) were the two entry points; both now go
  through the one `endThenAfterPitch` helper — no third recording path was left on the old push-only flow.

## Verification

Typecheck of the whole project — clean:

```
$ npx tsc --noEmit -p tsconfig.json
tsc_exit=0
```

Nav + sales-coach test suites — all pass:

```
$ npx vitest run --allowOnly=false <nav|salesCoach|sales-coach|managerNav test files>
 Test Files  7 passed (7)
      Tests  24 passed (24)
vitest_exit=0
```

Full `npm run check` is the CI gate (runs the whole 1922-test suite + typecheck + lint + invariant/rls/tbc
audits). The changes are a redirect-with-end handler + label strings, no new data path.
