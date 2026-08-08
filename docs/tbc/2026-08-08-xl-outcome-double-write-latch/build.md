# BUILD — recordOutcome re-entrancy latch

### useRef latch on recordOutcome (the outcome-event append chokepoint)
- **write-path:** `src/app/dashboard/sales-coach/[id]/page.tsx` — added `const outcomeSubmitRef = useRef(false)`;
  guarded `recordOutcome` with `if (outcomeSubmitRef.current) return; outcomeSubmitRef.current = true;` before the
  first await, and `outcomeSubmitRef.current = false;` in the `finally`.
- **read-path:** the outcome buttons + `saveDealValue` both call `recordOutcome` → `/api/coach/sales-session/
  [id]/outcome` → `setSessionOutcome` → `events.insert(coach.session_outcome_recorded)`. The latch runs before
  the POST.
- **what:** a synchronous re-entrancy latch (checked+set before the first await), so a fast double-click can no
  longer fire two `/outcome` POSTs before React re-renders and disables the button. Released in `finally`, so a
  deliberate sequential re-record (a genuine correction) is unaffected. Mirrors `whySubmitRef`/`reviewSubmitRef`.
- **why:** `/outcome` appends an IMMUTABLE §3.1 event per call; the prior `savingOutcome` useState guard only
  disables the button on re-render (async), so a double-click wrote two identical outcome events — the
  append-only double-write class the codebase already fixes with useRef latches (A29 sweep sibling).

### verification
- **write-path:** none — `npx tsc --noEmit` → exit 0 (no errors on the [id] page); full `npm run check` in check.md.
- **read-path:** the fix is UI re-entrancy (no DOM in the node test env), so it's runtime-unproven here (not exercised) — same
  posture as the existing latches, which are also ungated (grep-confirmed no test references them). The chokepoint
  gate (server idempotency) is flagged in closure as the founder-gated stronger option.
