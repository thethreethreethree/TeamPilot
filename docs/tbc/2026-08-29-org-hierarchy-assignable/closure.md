# CLOSURE — assignable org tiers (stage 2 of the team reorg)

## What shipped
The 6-tier hierarchy is now ASSIGNABLE. Admins get a per-member org-role dropdown on the company team page (8 roles
grouped by tier) that posts to a new guarded route (`POST /api/team/set-role`) — admin-only, service-role,
tenant-pinned (INV15), and refusing any change that would remove the company's last admin. The tier IS the `role`
field (founder's choice), so C-Suite (now incl. CFO) carries admin authority. Every roster from stage 1 already
orders by this, so a newly-assigned VP/Director/Manager/Supervisor sorts into place immediately.

## Verification (A38)
`npm run check` → EXIT 0. The route's auth + tenant-pin + last-admin safety are unit-gated (7 cases); the CFO admin
expansion swept its two pinned tests consciously. The dropdown render + live round-trip are founder visual-verify.

## The un-named reliance
- **The team-page dropdown + round-trip are founder visual-verify** — no jsdom harness for this client page; the
  route (the security-bearing half) is fully unit-tested.
- **Reassigning a founder from 'admin' to a tier**: allowed when another admin exists; the last-admin guard blocks
  the lockout case. Assigning a founder to 'CEO' keeps them admin (C-Suite).

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "INVITE at a tier (fast-follow): a brand-new person can only be invited as CEO/COO/Lead/Member today (the team_invitations.role CHECK). Inviting directly as VP/Director/Manager/Supervisor/CFO needs that CHECK widened (a migration via npm run db:apply) + the invite-role dropdown extended. Re-assigning after they join already works via set-role.",
    "why_skipped": "Staged: re-assignment (no migration) delivers the core assign-to-hierarchy need; the invite-at-tier needs a prod migration, done deliberately.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-29T09:15:00+08:00",
    "outcome": "OPEN — widen the invite CHECK + invite dropdown if you want to invite people straight into a tier."
  },
  {
    "id": "R2",
    "item": "Whether tiers BELOW C-Suite (VP, Director) should also have admin access is left at the default (C-Suite only). Elevating them changes real permission gates and is the founder's call.",
    "why_skipped": "The founder chose C-Suite = admin; broadening is a separate explicit decision.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-29T09:15:00+08:00",
    "outcome": "OPEN — add tiers to ADMIN_ROLES only on an explicit founder call."
  }
]
```
