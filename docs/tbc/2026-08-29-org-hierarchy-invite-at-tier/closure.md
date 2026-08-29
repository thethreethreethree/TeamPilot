# CLOSURE — invite people AT a tier (stage 3 / R1 of the team reorg)

## What shipped
A new hire can now be invited DIRECTLY into any org tier (C-Suite → Frontline) instead of invite-as-Member →
reassign. Migration 0239 widens the `team_invitations.role` CHECK to the 8 assignable tier roles + legacy 'Lead',
and — the load-bearing half — extends the 0141 privilege-escalation RLS policy to CFO (now an admin role), so a
non-admin still cannot mint an admin-tier invite. The invite dialog offers a tier-grouped dropdown; the route's
existing `isAdminRole` gate auto-covers CFO.

## Verification (A38)
`npm run check` → EXIT 0 (output pasted in check.md). `npm run db:apply` applied 0239 and `verify:live` re-confirmed
all 30 live invariants. The widened CHECK + the escalation-policy sync are pinned by unit drift-guards
(enumConstraintSync repinned to 0239; the new inviteRoleEscalationGate test asserts the SQL admin set ≡ ADMIN_ROLES).

## The un-named reliance
- **The invite dialog render + the live invite round-trip are founder visual-verify** — client component, no jsdom
  harness. The security-bearing halves (the CHECK, the RLS escalation policy, the route gate) are DB-applied +
  behaviorally verified (verify:live) + unit-pinned.
- **RLS escalation enforcement is verified by the policy-text drift-guard + verify:live's tenant-isolation checks**,
  not by a live "anon/non-admin INSERT is rejected" behavioral test — that path needs a seeded non-admin session
  against live Postgres (my standing note: RLS INSERT rejection is unverifiable in the sandbox).

## Residual (A36 — explicit)
```json
[
  {
    "id": "R3",
    "item": "The invite dropdown shows C-Suite (CEO/CFO/COO) options to EVERY inviter; a non-admin who picks one gets a 403 from the route. The gate is correct + honest, but a non-admin sees options that will be refused (pre-existing for CEO/COO; this adds CFO). A layer-3 polish would hide the C-Suite optgroup unless the viewer is an admin — needs the dialog to receive the viewer's admin status.",
    "why_skipped": "Out of R1's scope (invite-at-tier); the security is enforced at route + RLS. Filed as a UX follow-up, not a correctness gap.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-29T10:05:00+08:00",
    "outcome": "DONE (2026-08-29, same feature) — roles.ts inviteRoleGroups(canInviteAdmin) hides any admin-role tier group when the viewer isn't an admin; InviteMemberDialog derives amAdmin from isAdminRole(useCurrentUserRole()). Gated on the isAdminRole verdict (not a hardcoded 'C-Suite' label), null-role loads as non-admin (safe default), unit-tested in roles.test. Server-side gate unchanged — presentation only."
  },
  {
    "id": "R2",
    "item": "(carried from stage 2) Whether tiers BELOW C-Suite (VP, Director) should also have admin authority is left at the default (C-Suite only). Elevating them changes real permission gates and is the founder's call.",
    "why_skipped": "The founder chose C-Suite = admin; broadening is a separate explicit decision.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-29T10:05:00+08:00",
    "outcome": "OPEN — add tiers to ADMIN_ROLES only on an explicit founder call (and the escalation drift-guard will then require the 0141/0239 policy to follow)."
  }
]
```
