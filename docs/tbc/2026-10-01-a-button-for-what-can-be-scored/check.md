# CHECK - a button for what can be scored

## Commands

```
$ npx vitest run src/app/api/coach/sales-session/pitch-score/backfill src/components/sales-coach/__tests__/UnscoredBacklog.render.test.tsx
      Tests  40 passed (40)
exit 0

$ (mutation: GET back to { unscored: ids.length })        Tests  2 failed | 21 passed (23)    exit 1
$ (mutation: threshold copied as  n > MIN_AGENT_SEGMENTS)   Tests  3 failed | 20 passed (23)    exit 1
(both restored)

$ npm run visual -- unscoredBacklog
  artifacts/visual/unscored-backlog-unscorable.{light,dark}.png
exit 0
```

Opened, one at a time:
- unscored-backlog-unscorable.light.png: cream panel, amber border; "95 recordings have never been scored",
  the explanation, then "101 more have no rep speech, so they can't be scored."; yellow "Score them all".
- unscored-backlog-unscorable.dark.png: the same on a dark brown panel with a gold border; all text readable.

The full `npm run check` is appended below.

## Findings

### The backlog count offered a button for recordings the scorer always refuses

class: a count of work that includes items the worker refuses by rule
sweep: grep -rn "PERMANENT_REFUSALS" src - every permanent refusal reason must be excluded from or named by a count that offers to act
severity: medium

## Not opened

The other capture images were not opened; none changed in this build.

## Appended — the full gate (against postgres:16-alpine)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 npm run check
      Tests  5604 passed | 15 skipped (5619)
  RLS probes:              1 run, 0 failed
✓ 3 claim(s) checked against real Postgres.
CHECK_EXIT=0
```
