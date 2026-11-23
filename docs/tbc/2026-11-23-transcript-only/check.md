# CHECK - Keep transcripts only

## Commands

```
npx vitest run retention.test.ts, recording-purge-cron, settings/retention → 34 passed, exit 0
mutation: hasTranscript condition removed → 2 failed | 20 passed; live condition removed → 1 failed | 10 passed; restored
npx tsc --noEmit -p . → exit 0
```

Full migration chain on PGlite, then 0314 again:

```
migrations replayed; failures: 0
count + transcript_only: refused
rows: [{"keep_last_per_rep":null,"transcript_only":true},{"keep_last_per_rep":20,"transcript_only":false}]
exit 0
```

Production:

```
npm run db:apply → applying 0314_transcript_only_retention.sql … ok · DB now at 0314 · ✅ ALL 32 invariants hold
```

## Findings

### F1 - the Protection screen showed a failed retention read as "Loading…" forever
class: failed read rendered as a waiting state.
sweep: `grep -n "catch(() => null)" src/components/sales-coach/ProtectionSettings.tsx` → the retention load (fixed:
"Couldn't load" + Try again) and the audit load (already says its error).
severity: low

### F2 - the cron's transcript check is one query per call
class: N small queries in a cron.
sweep: `grep -n "transcriptChecks >= BATCH" src/app/api/coach/sales-session/recording-purge-cron/route.ts` → bounded by
BATCH (500) per run, and only for transcripts-only companies' finished calls past the day.
severity: low
