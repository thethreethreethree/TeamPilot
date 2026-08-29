# CHECK — onboarding invite-at-tier + pure invite dialog

## Gate — the canonical command (A38)
```
$ npm run check   # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  595 passed | 1 skipped (596)
        Tests  3931 passed | 15 skipped (3946)
PIPE_EXIT=0
```

## What the gate locks
- typecheck: `InviteMemberDialog`'s new required `canInviteAdmin` prop is supplied at BOTH call sites (team + chats)
  — a call site that forgot it would fail the build, so a non-admin can't silently default to seeing C-Suite.
- roles.test (existing, from R3): `inviteRoleGroups(true)` returns all six tiers C-Suite-first; `inviteRoleGroups(false)`
  drops every admin-role group — the same helper the onboarding dropdown now consumes, so onboarding inherits that
  coverage.

## Not unit-gated (founder visual-verify)
- The onboarding invite dropdown render + the team/chats dialog render (client pages, no jsdom harness). The role
  SOURCE (inviteRoleGroups) is unit-tested; the wiring is typechecked.

## Findings
No findings. The onboarding surface now shares the single role source; the dialog refactor is behaviour-preserving
(gating unchanged, only the input source moved to the parent) and removes a redundant fetch.
