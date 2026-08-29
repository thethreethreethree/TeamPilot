# BUILD — invite people AT a tier (stage 3 / R1)

### The widened invitable vocabulary (one axis, one source)
- write-path: `roles.ts` — `INVITABLE_ROLES` → the 8 assignable tier roles + legacy `'Lead'` (9), mirroring the
  0239 CHECK. Presentation stays separate: the invite dropdown reads `ORG_ROLE_OPTIONS` (curated 8, tier-grouped).
- read-path: `validate.ts` `RoleSchema = z.enum(INVITABLE_ROLES)` auto-widens; the route validates against it.

### The migration (widen the CHECK + close the escalation ripple)
- write-path: `0239_team_invite_tier_roles.sql` — DROP+ADD `team_invitations_role_check` to the 9-role set (CHECK
  written FIRST so the enumConstraintSync regex matches it, not the policy's `p.role in (...)`), then re-create the
  0141 INSERT policy with `CFO` added to BOTH terms (`role not in ('CEO','CFO','COO')` + `p.role in
  ('CEO','CFO','COO','admin')`). Idempotent. Applied via `npm run db:apply` (ledger, never hand-applied).
- read-path: an admin can invite at any tier; a non-admin inviting a C-Suite (CEO/CFO/COO) role is refused by the
  RLS policy (direct-client path) and the route (API path).

### The route + UI
- write-path: `/api/team` POST — the escalation gate already branches on `isAdminRole(safeRole)` (the VERDICT, §2.2),
  so it auto-covers CFO; only the 403 copy now names "(CEO/CFO/COO)". `InviteMemberDialog.tsx` — the Role `<select>`
  renders `ORG_ROLE_OPTIONS` as tier `<optgroup>`s; the hint copy stops hardcoding "CEO, COO, Lead, or Member".
- read-path: the inviter picks a tier from a grouped dropdown (C-Suite → Frontline); the invitee lands at that tier
  on accept (`accept_invitation` 0114 writes `profiles.role`; no CHECK on profiles.role, ranks + admin-classify work).

### Adjacent honesty fix (§3.4, found via §1.5.2 audit)
- write-path: `chats/page.tsx` invite hint claimed "The invitee gets an email with the link" — FALSE (the System
  never auto-sends; the dialog is explicit). Rewritten to say the inviter delivers the link + reference tiers.
  `useCurrentUserRole.ts` doc-comment role enumeration updated to the full tier vocabulary (was missing CFO/VP/…).
- read-path: a user reading the invite hint is told the truthful delivery model (create → deliver yourself), so the
  copy matches what the dialog actually does; a developer reading the hook sees the accurate role value set.

## Files
- `supabase/migrations/0239_team_invite_tier_roles.sql` — CHECK widen + escalation-policy CFO extension
- `src/lib/roles.ts` — INVITABLE_ROLES widened to the tier set (+ legacy Lead)
- `src/components/team/InviteMemberDialog.tsx` — tier-grouped dropdown + copy
- `src/app/api/team/route.ts` — 403 copy
- `src/app/dashboard/chats/page.tsx` — honest + tier-aware invite hint (import cleanup)
- `src/lib/hooks/useCurrentUserRole.ts` — doc-comment accuracy
- tests: `roles.test.ts` (INVITABLE pin → 9, conscious expansion), `enumConstraintSync.test.ts` (pin → 0239),
  `inviteRoleEscalationGate.drift.test.ts` (NEW — the RLS admin set ≡ ADMIN_ROLES drift-guard)

## Ripple (§6 item 5 / A40)
- `CFO` is already in ADMIN_ROLES, so widening invitability to CFO REQUIRED extending the 0141 escalation policy —
  done in 0239, and pinned by the new drift-guard so a future admin-tier addition can't skip it silently.
- No accept-path or profiles change: profiles.role has no CHECK; the tiers rank + classify via existing roles.ts.
- Legacy `'Lead'` retained in the CHECK (existing rows) + INVITABLE (drift-guard equality); not offered in the UI.
