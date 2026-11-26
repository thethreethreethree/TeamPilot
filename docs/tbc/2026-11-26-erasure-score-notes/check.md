# CHECK - Legal erasure blanks typed score notes

## Commands

```
diff 0364's rss_erase_sessions body vs 0366's → exactly the two statements (+ comment)
npm run db:verify → 0366 ok; npm run db:apply → verify:live passed
production Postgres, rolled back → 2/2 (dispute note erased, record kept; override reason erased, correction kept)
node scripts/invariant-audit.mjs → 0 (0366 on the erasure-extension list with why)
npm run check → gates the commit
```

## Findings

### F1 - typed score notes survived erasure
class: text a person typed about an erased call's score.
sweep: every pitch-subject event writer (2 kinds) and pitch_score_overrides.reason.
severity: medium (privacy)
