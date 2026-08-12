# CHECK — two §3.4 display-honesty fixes

## Verification run (A38)
Canonical command: `npm run check`.

## Findings
### F1 — a count-read failure silently reverted the finance register to "complete"
file+line: `finance/bank/accounts/[id]/transactions/route.ts` — the head-count fallback left `total = rows.length`
on a count failure → `truncated` false → the disclosure vanished, silently re-hiding older lines.
class: honesty-thesis silent-truncation on an error edge (§3.4). severity: low (rare edge) / principled.
sweep-command: `grep -n "truncated\|total" finance/bank/accounts/[id]/transactions/route.ts` — the only disclosure
on that surface; no sibling re-hides on error after the fix.

### F2 — after-pitch header claims a "conversation" for a session that captured none
file+line: `sales-coach/[id]/after-pitch/page.tsx` — "· {dur} conversation" showed whenever `dur` (wall-clock
fallback for no-audio) was truthy, contradicting the "No conversation was captured" body (founder screenshot).
class: honesty-thesis — a header claim the body denies (§3.4). severity: medium (founder-visible incident surface).
sweep-command: `grep -n "conversation\|dur ?" sales-coach/[id]/after-pitch/page.tsx` — the single subtitle render;
`conversationDurationSeconds` (the shared duration source) is unchanged (its wall-clock fallback is correct for a
CAPTURED live call) — only the LABEL is gated.

## Tests
```
$ npx vitest run src/app/api/finance/bank/accounts/[id]/transactions
 Test Files  1 passed (1)
      Tests  6 passed (6)
```
F1: +2 edges (count-failure discloses with total:null; exactly-1000 not truncated), mutation-checked. F2 is a
React display gate (node-untestable) on the existing `dur`/`summary` values — honest per A30.

## Full gate
```
PENDING — pasted in closure after the run
```
