# CLOSURE — ResolutionCaptureModal state-bleed fix

## What shipped

`key={selected.id}` on `<ResolutionCaptureModal>` in `ConversationsApp` — so switching the selected
conversation remounts the modal and resets its form, instead of carrying one conversation's half-typed
resolution draft into another's. Closes both the UX confusion and the data-integrity risk (submitting A's
summary as B's resolution into the append-only record). Found via the `reference_context_switch_state_bleed_class`
recurring-class sweep — the 4th instance of a class fixed 3× before with the same remedy.

## What I relied on that is NOT self-evident (the un-named-reliance half)

- **React reuse semantics:** without a `key`, React reuses a component instance at the same tree position
  across renders even as props change — which is exactly why the form state survived a conversation switch.
  The fix relies on `key` forcing reconciliation to treat a new `selected.id` as a new element (remount).
- **The modal self-clears only on submit:** the bug existed because the ONLY reset was after a successful
  POST; a cancel/close left the state. An alternative fix (a reset-on-conversationId `useEffect` inside the
  modal) would also work, but `key` is the class's established, less-error-prone remedy (no dep list to get
  wrong).

## Residual (A36)

```json
[
  {
    "id": "RES-01",
    "item": "No automated regression test locks this specific state-bleed. The fix is a structural `key`, and a reproduction needs a React render+interaction harness (open modal on A, type, switch to B, reopen, assert blank).",
    "why_skipped": "The prior 3 instances of this class were fixed with `key={id}` without per-instance render tests; a brittle render test for a one-line structural fix is low-value. The structural `key` can't silently regress the way a dep-listed effect could.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-31T15:08:00Z",
    "outcome": "OPENED + accepted: structural fix over a brittle render test. If this class recurs a 5th time, a shared lint (every `selected`-bound stateful modal must key on the id) would be the durable A30 gate — named as the escalation path."
  }
]
```

## Verification

Typecheck of the changed component clean (0 errors, see check.md). Full `npm run check` is the CI gate.
