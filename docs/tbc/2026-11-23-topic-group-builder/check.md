# CHECK - Make and edit topic groups by hand

## Commands

```
npx vitest run TopicGroups.render.test.tsx src/app/api/coach/remote/market → 20 passed (candidate list: other groups excluded, the edited group included, managers only; make posts source "manager"; edit opens ticked by wording and posts replaces)
npm run check (first) → exit 0 — FALSE GREEN: this build's think.md had not been written (a script error), and the gates validated docs/tbc/2026-11-23-security-alert instead
npx vitest run scripts/tbc/__tests__ → 19 passed (newDirsWithoutThink + the selection gap pinned)
probe: a staged docs/tbc/2099-01-01-probe with no think.md → node scripts/tbc/verify-freshness.mjs → ✗ "2099-01-01-probe: a new build record with no think.md" (probe removed, unstaged)
```

## Findings

The feature itself: the form reuses the save route's checks, so a topic the list shows is one the save accepts.

### F1 - a new record dir with no think.md let every TBC gate pass on the PREVIOUS build
class: a gate that selects what to check, and silently selects something else when the expected input is missing.
sweep: currentBuildDir() ranks a dir without started_at below every real build; tbc:freshness deferred "no think.md" to
tbc:manifest, which only reads the selected dir. Ten 2026-09 dirs legitimately have no think.md (pre-rule, committed).
severity: high (a record can ship unchecked with the check green)

## Final

```
npm run check → exit 0 · Test Files 894 passed | 1 skipped · Tests 6616 passed | 15 skipped (this build's own record selected: build: docs/tbc/2026-11-23-topic-group-builder)
```
