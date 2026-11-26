# CHECK - Brief templates: a manager's questions, answered from a call

## Commands

```
npm run db:verify → 0364 ok; npm run db:apply → verify:live passed
diff 0351's rss_erase_sessions body vs 0364's → exactly the custom_briefs delete (2 lines)
npx vitest run briefTemplates brief-templates custom-brief CustomBriefs.render → 2 + 6 + 4 passed
noFailedReadAsEmpty, americanSpelling → passed; invariant-audit 0 (templates route on the tree allowlist, 0364 on the erasure-extension list, both with why); rls-audit passed; reachability passed; theme clean; tsc clean; eslint clean
npm run check → gates the commit
```

## Findings

### F1 - no admin-defined briefs
class: missing feature (F13.2).
sweep: call briefs.
severity: medium
