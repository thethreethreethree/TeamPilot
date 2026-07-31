# CHECK — ResolutionCaptureModal state-bleed fix

## Audit of the build

- **Minimal + behavior-preserving where it should be:** the only change is the remount lifecycle. Within one
  conversation (close+reopen the modal) the key is unchanged, so a legitimate in-progress draft still
  persists — the fix targets ONLY the cross-conversation bleed.
- **Fixes the data path, not just the UI:** the corrupted-resolution risk (A's summary posted as B's
  resolution) is closed at the source — the form can't carry stale text into a different conversation's POST.
- **Established pattern:** `key={id}` is the same remedy the prior 3 instances of this class used.

## Findings (class sweep — A26)

- **ResolutionCaptureModal** — the state-bleed instance (5 form hooks, no reset-on-close, parent had no key).
  **FIXED** with `key={selected.id}`.
- **TaskRefinementPanel** (sibling, also `selected`-bound) — **SAFE**: has an explicit `useEffect([open])`
  that resets `draft`/`error`/`adjustmentPrompt` + regenerates on each open. No fix needed.
- The other `selected`-bound tool panels (Summarize/Dissect/Formulate/AskCoach) fetch their content on open
  (display panels, not persistent input forms) — not the input-form-bleed shape.

## Verification

Typecheck of the changed component — clean (the `key={selected.id}` addition compiles; `selected.id` was
already referenced on the adjacent prop line, so it is in scope):

```
$ npx tsc --noEmit -p tsconfig.json   (filtered to the changed file)
TYPECHECK_ERRORS_IN_FILE=0
```

Exit: 0 errors in `ConversationsApp` / `ResolutionCapture`. (Full `npm run check` is the CI gate; the change
is a JSX `key` addition with no new logic, so no unit test is added — a state-bleed reproduction needs a
render+interaction harness, and the class's established fix is the structural `key`, consistent with the
prior 3 instances.)
