# CHECK — invite people AT a tier (stage 3 / R1)

## Gate — the canonical command (A38)
```
$ npm run db:apply   # applies 0239, then verify:live (30 live invariants) — ✅ ALL 30 invariants hold
$ npm run check      # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  595 passed | 1 skipped (596)
        Tests  3928 passed | 15 skipped (3943)
PIPE_EXIT=0
```

## What the tests lock (A30)
- `enumConstraintSync` (repinned 0008 → 0239): `INVITABLE_ROLES` ≡ the live `team_invitations.role` CHECK set — a
  role the invite accepts can't fail the DB CHECK on insert (privilege-relevant).
- `inviteRoleEscalationGate.drift` (NEW): the 0239 RLS policy's admin-check `p.role in (...)` ≡ `ADMIN_ROLES`, and
  its `role not in (...)` exclusion ≡ `ADMIN_ROLES \ {admin}`. Guards the CFO-class escalation drift structurally.
- `roles.test`: `INVITABLE_ROLES` = the 9 (8 assignable + legacy Lead), conscious expansion; `isInvitableRole`
  accepts every tier role, rejects the onboarding 'admin' + junk.

## Not unit-gated (founder visual-verify)
- The tier-grouped invite dropdown render + the live invite→accept round-trip landing a new member at the chosen
  tier (client component, no jsdom harness). The CHECK + RLS escalation policy + route gate are the security-bearing
  halves and are DB-applied + verify:live-confirmed + unit-pinned.

## Findings
No findings — the widened CHECK is a strict superset of the old one (existing rows stay valid); the escalation
policy gained CFO in lockstep with ADMIN_ROLES and is now drift-guarded; the route gate consumes the isAdminRole
verdict rather than re-deriving it.
