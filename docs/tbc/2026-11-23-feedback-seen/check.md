# CHECK - Clear a feedback answer once the rep has seen it

## Commands

```
npx vitest run my-coaching feedback-seen FeedbackRequest.seen.render routine RepRoutine.render → all passed (my-coaching + feedback-seen 6, render 2, routine + RepRoutine 5)
node scratchpad/replay0321.mjs (every migration, then 0321 again; signed in as the rep) → first run: every insert "permission denied for table profiles" — the local database lacked Supabase's default grants to authenticated → grants added → own call → stored · a colleague's call → refused (RLS) · as someone else → refused · other company's id → refused · rep sees: 1 · update/delete as owner → row unchanged
npm run db:apply → applied 0321 · DB now at 0321 · ✅ ALL 33 invariants hold
```

## Findings

### F1 - the first local policy probe refused everything, including the legitimate insert
class: a test harness missing the platform's defaults reads as "the policy refuses".
sweep: the earlier replays tested tables as the owner; this one runs as the signed-in rep, which needs Supabase's
default grants; with them the policy alone decides.
severity: low (test harness only)

## Final

```
npm run check → first: ✗ typecheck (mock fetch typed with no argument in the new render test) → fixed → ✗ rls:audit (feedback_answer_views update/delete) → allowlisted as append-only → exit 0 · Test Files 896 passed | 1 skipped · Tests 6621 passed | 15 skipped
```
