# CHECK - Engage E5: agents

## Commands

```
npm run db:verify → 0379 ok (rolled back)
probe p0379.mjs (production, rolled back): valid agent ok; no trigger part 23514; unknown action 23514; edit P0001; off ok;
  rss_agent_can_see: self true, admin true, another rep false; agent_ran notification ok
npx vitest run src/lib/coach/remote/engage src/components/sales-coach/__tests__/NotificationBell.render.test.tsx → 47 passed (exit 0)
npx vitest run "src/app/api/coach/remote/prospects/[pid]/brief" → 4 passed (exit 0)
tsc clean · rls / invariant / reachability / writer / theme / enum audits ✓
npm run check → gates the commit
```

## Findings

### F1 - the deal brief was written in one route only
class: a second writer about to appear (the agent).
sweep: writeDealBrief extracted; the route and the runner both call it.
severity: medium (two writers would drift on basis and storage).
