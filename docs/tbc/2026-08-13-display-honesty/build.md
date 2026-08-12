# BUILD — two §3.4 display-honesty fixes

## Feature inventory
### F1 — finance register discloses truncation even when the head-count read fails
- write-path: none. N/A.
- read-path: `finance/bank/accounts/[id]/transactions` returns `total: number | null` (null when the head count
  fails on a full page) and `truncated = pageFull && (total === null || total > rows.length)`. So a full page
  always discloses; exactly-1000 is not truncated. The banking page renders "of N" when known, "there may be
  older lines" when null. Pinned by 6 route tests (incl. the count-failure + exactly-1000 edges), mutation-checked.

### F2 — after-pitch header stops calling an un-captured session a "conversation"
- write-path: none (read-only header render). N/A.
- read-path: the subtitle renders "· {dur} conversation" only when `session.audioDurationSeconds` (real uploaded
  audio) OR `summary?.hasSignal` (a captured transcript) is truthy; otherwise `dur` is just idle wall-clock and the
  header falls through to the context label — no "conversation" claim over a "No conversation was captured" body.
  React display gate on the existing `dur`/`summary` values (node-untestable, A30 honest).

## Files changed
- src/app/api/finance/bank/accounts/[id]/transactions/route.ts — total:number|null; truncated keys on pageFull.
- src/app/dashboard/finance/banking/page.tsx — state total:number|null; disclosure handles the null branch.
- src/app/api/finance/bank/accounts/[id]/transactions/__tests__/route.test.ts — +2 edge tests.
- src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx — gate the "conversation" label on captured content.

## Holistic (§1.5.1)
F1 changes only the count-failure + exactly-1000 edges; F2 only the empty/no-capture header. Captured sessions
(upload or live-with-transcript) are unchanged. No schema/read added.
