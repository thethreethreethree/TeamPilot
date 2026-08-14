# REMEDIATE — password-recovery REQUEST flow

## F1 — add the missing request entry point + guard the completion dependency
Remediation: shipped the request side of recovery — a pure helper (`src/lib/auth/passwordRecovery.ts`), a new
`/auth/forgot` page that calls `resetPasswordForEmail` with a redirect back to the existing `/auth/recover`, and
a "Forgot password?" link on both login surfaces. The confirmation is neutral (anti-enumeration, §3.4); demo mode
states it has no auth rather than pretending to send.
gate-or-promise: gate. `src/lib/auth/__tests__/passwordRecovery.test.ts` encodes the class so it fails without my
cooperation: (a) the redirect must resolve to `<origin>/auth/recover`; (b) the completion page must exist on disk
(rename/delete `src/app/auth/recover/page.tsx` → red); (c) the confirmation must stay anti-enumeration. A future
edit that breaks the redirect, removes the completion page, or leaks account existence reddens the build.
class: missing-surface / workflow-continuity. severity: medium. Fixed.

## Note
The client pages themselves carry no component test (the repo has 0 `*.test.tsx`; client auth pages rely on
typecheck/lint + manual/E2E). The testable logic was extracted into the helper precisely so the class could be
gated in the codebase's established `src/lib/**/__tests__` style rather than introducing a new test harness.
