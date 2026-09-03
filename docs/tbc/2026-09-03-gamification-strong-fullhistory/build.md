# BUILD — Arena "strong sessions" over the full history

### Server computes strong over the full paged set
- write-path: `my-points/route.ts` — `const strong = all.filter(r => r.points >= STRONG_SESSION_THRESHOLD).length`
  over the FULL history; returned alongside total/avg/sessions.
- read-path: the Arena stat "strong sessions X/Y" now has X and Y both over the full history — consistent at any
  scale.

### deriveArena prefers the server value
- write-path: `arenaSummary.ts` — `deriveArena` takes `input.strong`; `const strong = input.strong ?? rows.filter(...)`.
  Used for the stat AND the "strong" milestone.
- read-path: a veteran rep (>200 sessions) sees their true strong count + keeps the strong milestone even if their
  strongs predate the recent window.

### Component passes it through
- write-path: `RepArena.tsx` — `strong: mp.strong ?? null` into deriveArena; `MyPoints` type gains `strong?`.
- read-path: unchanged UI; the number is now correct.

## Files
- `src/app/api/coach/gamification/my-points/route.ts` (+ strong) and `__tests__/route.test.ts` (assert strong)
- `src/lib/coach/gamification/arenaSummary.ts` (+ input.strong) and `__tests__/arenaSummary.test.ts` (+2 tests)
- `src/components/sales-coach/RepArena.tsx` (pass strong)

## Ripple (§6 item 5)
- Fallback preserved: deriveArena still counts `rows` when `strong` is absent, so any other caller is unaffected.
- No schema/RLS/auth change; `strong` is computed from the same owner-scoped read (A18 intact).
- Bounded: one extra integer in the response; no extra query (counted from the already-paged `all`).
