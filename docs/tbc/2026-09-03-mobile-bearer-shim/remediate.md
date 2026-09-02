# REMEDIATE — accept a mobile Bearer token on the coach routes

### F1 — /outcome was made to require a company context it never required

Fixed by splitting the resolver. `resolveApiUserId` resolves identity **only** — no
company, no role — and is what `/outcome` uses. `resolveApiAuth` keeps the full
`AuthContext` for the routes that genuinely need a company. The route's own existing tests
pass unmodified, which is the same signal that caught the regression.

gate-or-promise: gate. `src/app/api/coach/sales-session/[id]/outcome/__tests__/` already
  asserts a 200 for a signed-in caller through this route; that test is what turned red and
  is what holds the requirement now. It fails without this author's cooperation, which is
  the property A30 asks for. No new test was needed — the existing one was already the
  gate, and the honest record is that it worked.

### F2 — the canonical gate was substituted with a faster subset

Fixed for this branch by running `npm run check` in full and repairing what it found
(the unused import). The class is not fixed by that, and pretending otherwise would be the
prose-only fix A30 names.

gate-or-promise: declined, with the hole named. The check that would close this class is
  one that refuses a TBC build whose check.md pastes anything other than the canonical
  gate's own output — and `verify-artifacts.mjs` already carries the adjacent half of it
  (assurance words must sit beside a pasted exit code), which is what forced the paste
  above. Extending it to demand the *specific* canonical command is a change to a shared
  enforcement script, made from inside the branch it would be judging. That is the wrong
  place and the wrong moment for it. The hole that remains: a future build may still paste
  a subset's output beside an exit code and satisfy every check here. CI is the backstop —
  `ci.yml` runs all seven plus `next build` on every push to `main` — so the failure mode
  is a red `main`, not a silent one.
