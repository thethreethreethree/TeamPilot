# BUILD — assignable org tiers (stage 2)

### The assignable vocabulary + C-Suite = admin
- write-path: `roles.ts` — `ORG_ROLE_OPTIONS` (8 roles grouped by tier), `ASSIGNABLE_ORG_ROLES`,
  `isAssignableOrgRole`; `CFO` folded into `ADMIN_ROLES` (C-Suite = admin).
- read-path: the dropdown offers the assignable roles; the set-role route validates against them; C-Suite roles
  gate admin authority everywhere `isAdminRole` is consumed (auth-helpers re-exports the same set).

### The guarded, tenant-pinned, lockout-safe write
- write-path: `POST /api/team/set-role` — admin-only + service-role (profiles.role is guarded) + INV15 (target must
  be in the caller's company; the write is company-scoped). Refuses a demotion that would remove the LAST admin (409).
- read-path: an admin changes a member's tier; a non-admin / cross-tenant / lockout attempt is refused with an
  honest status, never a silent write.

### The assignment control
- write-path: `dashboard/team/page.tsx` — an admin-only `<select>` per member posts to set-role; the line shows the
  tier label (`orgTierLabel`).
- read-path: admins set each person's tier inline; non-admins see the tier read-only.

## Files
- `src/lib/roles.ts` (+ `roles.test.ts`, + `authHelpers.isAdminRole.test.ts`) — assignable vocab + CFO admin
- `src/app/api/team/set-role/route.ts` (+ test) — the guarded role-change route
- `src/app/dashboard/team/page.tsx` — the assignment dropdown + tier label

## Ripple (§6 item 5)
- The CFO addition to ADMIN_ROLES is a NEW value (no user is CFO), so no existing authority changes; the two pinned
  admin-set tests were updated CONSCIOUSLY (deliberate expansion, not silent drift). auth-helpers re-exports the
  single ADMIN_ROLES, so the ~12 gates that use isAdminRole pick it up uniformly.
- No migration: profiles.role has no CHECK. Inviting AT a tier (team_invitations.role CHECK) is the deferred
  fast-follow — existing invites (CEO/COO/Lead/Member) are unchanged.

## Honest limit (verify)
- The route's auth + tenant-pin + last-admin safety are unit-gated (7 cases). The dropdown rendering + the live
  round-trip on the team page are founder visual-verify (client page, no jsdom harness); the wiring is typechecked.
- The finer tiers can now be ASSIGNED to existing members; inviting a brand-new person directly at a tier is the
  fast-follow (needs the invite CHECK widened + the invite dropdown updated).
