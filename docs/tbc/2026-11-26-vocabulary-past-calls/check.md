# CHECK - Fix past calls with the vocabulary's corrections

## Commands

```
npm run db:verify → 0368 ok; npm run db:apply → applied (the ledger lists 0368), the process then hung under load (load average 26) before verify:live; stopped; npm run verify:live run on its own → 33 passed, 0 failed
production Postgres, rolled back → 3/3 (view exposes id and version; stale version refused; next version copies every line, changes only the named one)
npx vitest run vocabularyReapply reapply route VocabularySettings.render → 1 + 3 + 8 passed
noFailedReadAsEmpty, americanSpelling, audit → passed; invariant-audit 0 (tenant and hide allowlist entries with why); theme clean; tsc clean; eslint clean
npm run check → gates the commit
```

## Findings

### F1 - corrections never reached past calls
class: a fix applied going forward only.
sweep: transcripts and everything derived from them (via generateSessionArtifacts).
severity: medium
