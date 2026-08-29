# CLOSURE — onboarding invite-at-tier + pure invite dialog (audit sweep)

## What shipped
A §1.7 ground-up audit of the invite-at-tier feature surfaced two things, both fixed here: (1) the onboarding
wizard's invite dropdown was the last surface still hardcoded to the old role set — it now offers all tiers from
the single source, so a founder can invite at any tier from the very first invite; (2) R3's admin-status fetch,
which lived inside the always-mounted invite dialog, is lifted to the parent — the dialog is a pure presentational
component taking `canInviteAdmin` as a prop, removing a redundant (and, on the team page, duplicate) fetch. The
audit found no other stale-role assumptions in `src/`.

## Verification (A38)
`npm run check` → EXIT 0 (pasted in check.md). The required-prop refactor is typecheck-enforced at both call sites;
the onboarding dropdown reuses `inviteRoleGroups` (unit-tested in roles.test). The three-stage team reorg is now
complete on every invite surface: onboarding, the in-app dialog, the team-page assignment control.

## The un-named reliance
- **The onboarding + dialog renders are founder visual-verify** (client pages, no jsdom harness). The role source is
  unit-tested; the wiring is typechecked.
- **The onboarding C-Suite invite works only because the founder is already admin when invites POST** (page.tsx:190,
  after the onboarding RPC commits) — the same precondition the pre-existing CEO/COO option relied on. If that POST
  order ever changes, a C-Suite onboarding invite would 403.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R2",
    "item": "(carried) Whether tiers BELOW C-Suite (VP, Director) should also have admin authority is left at the default (C-Suite only). Elevating them changes real permission gates and the escalation drift-guard would then require the 0141/0239 policy to follow.",
    "why_skipped": "The founder chose C-Suite = admin; broadening is a separate explicit decision.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-29T10:20:00+08:00",
    "outcome": "OPEN — add tiers to ADMIN_ROLES only on an explicit founder call."
  }
]
```
