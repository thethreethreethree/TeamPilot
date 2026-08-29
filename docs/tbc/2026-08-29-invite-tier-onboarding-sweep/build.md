# BUILD — onboarding invite-at-tier + pure invite dialog

### Finding 1 (HIGH): the onboarding invite dropdown now uses the single source
- write-path: `onboarding/page.tsx` — the invite `<select>` renders tier-grouped `<optgroup>`s from
  `inviteRoleGroups(true)` (was four hardcoded `<option>`s: Member/Lead/COO/CEO). The founder onboarding is the
  company admin, so `true` offers all tiers incl. C-Suite.
- read-path: a founder onboarding a company can pick any tier (C-Suite → Frontline) for each teammate on the very
  first invite, exactly as they can later from the team page + the in-app dialog. Safe: invites POST after the
  onboarding RPC commits the founder's admin profile (page.tsx:190), so the route/RLS admin gate accepts C-Suite.

### Finding 2 (EFFICIENCY): the invite dialog is a pure presentational component again
- write-path: `InviteMemberDialog.tsx` — removed the internal `useCurrentUserRole()`; added required
  `canInviteAdmin: boolean` prop; `roleGroups = inviteRoleGroups(canInviteAdmin)`. `team/page.tsx` passes the
  `amAdmin` it already computes; `chats/page.tsx` computes `amAdmin` once in `TeamChatListInner` and passes it.
- read-path: an admin still sees C-Suite invite options; a non-admin still doesn't — identical behaviour, but the
  always-mounted dialog no longer fires a redundant auth/profile fetch on every page load (and no duplicate on the
  team page). The prop is required, so typecheck enforces every call site supplies it (no silent non-admin default).

### The audit's clean layers (§1.7 — flags, not silence; recorded so an empty list isn't mistaken for un-audited)
- write-path: n/a (verification only). read-path: the following were checked and are SOLID — role→label/color/icon
  maps (none org-role-keyed; display is `orgTierLabel()` or raw passthrough, both render new tiers correctly),
  narrow union types (none; `role` is typed `string`), exhaustive switches / `Record<Role,X>` (none), roster
  sort (`byOrgRank` ranks all tiers), and every authority gate (delegates to `isAdminRole`, correctly non-admin for
  VP/Director/Manager/Supervisor). Accept path (`accept_invitation` 0114) copies `invitation.role` faithfully.

## Files
- `src/app/onboarding/page.tsx` — tier-grouped invite dropdown from inviteRoleGroups (+ import)
- `src/components/team/InviteMemberDialog.tsx` — pure component, `canInviteAdmin` prop (removed internal hook)
- `src/app/dashboard/team/page.tsx` — pass `canInviteAdmin={amAdmin}`
- `src/app/dashboard/chats/page.tsx` — compute `amAdmin` once, pass it (+ imports)

## Ripple (§6 item 5)
- Making the dialog prop-driven is a required-prop API change; typecheck confirmed both call sites pass it, and the
  existing test mock (`() => null`) is unaffected. No behaviour change to the gating — only where the input comes from.
- The onboarding fix reuses `inviteRoleGroups` (already unit-tested), so no new role-set surface is introduced.
