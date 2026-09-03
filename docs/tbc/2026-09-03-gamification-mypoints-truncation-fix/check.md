# CHECK — my-points summary truncation fix

## Typecheck: `npm run typecheck` → clean.

## Test: `npx vitest run src/app/api/coach/gamification/my-points/__tests__/route.test.ts` → 4 passed (was 3)
The +1 test feeds 205 session_score rows (10 pts each) and asserts: sessions=205 (full count, not 200),
total=2050 (SUM over all 205, not the first 200), rows.length=200 (trend bounded to the recent window), and
rows[0].session_id="s5" (the oldest 5 dropped — the recent 200 kept). This is the exact >200 case the old
ascending+limit(200) got wrong.

## Findings
- No new findings. The other three gamification routes were audited in the same pass and are correct: leaderboard
  delegates tenant-scope to the security-definer RPC; notifications mark-read is service-role pinned to
  recipient_id = caller; my-points (now fixed) is owner-pinned.

## Not claimed
- No live-data verification (dormant in the pilot; no rep near 200 sessions) — proven by unit test, not by
  observing prod.
- A server-side aggregate RPC (SUM in SQL) is not built — a future refinement if a rep's history ever gets large.
