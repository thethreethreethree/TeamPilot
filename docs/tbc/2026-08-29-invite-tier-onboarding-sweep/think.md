---
started_at: 2026-08-29T10:15:00+08:00
---

# THINK — onboarding invite-at-tier + pure invite dialog (audit sweep of the invite-at-tier feature)

## Why (a §1.7 ground-up audit of what stages 1-3 shipped)
After shipping invite-at-tier (0239) + the admin-gated dialog (R3), I ran a §1.7 ground-up audit of the roles/team
subsystem in the outside-view stance — sweeping `src/` for any consumer that assumes the OLD role set
{CEO,COO,admin,Lead,Member} and would mishandle the new tiers (CFO/VP/Director/Manager/Supervisor). The audit
returned exactly two things to act on; everything else (role→label/color maps, union types, exhaustive switches,
roster sort) routes through roles.ts correctly and needs no change.

## Understanding (the two findings — §1.5, §5)
1. **HIGH — onboarding invite dropdown (`onboarding/page.tsx:693`).** The founder's "invite your team" step
   hardcoded `<option>`s: only Member/Lead/COO/CEO — missing CFO and the whole middle of the hierarchy. It was the
   ONE invite surface not migrated to the single source, so a founder onboarding could not invite anyone at the new
   tiers. The founder's directive for this feature was explicit: *"this applies for ALL the system that lives under
   Elostate"* — so this surface is in-scope, not a nice-to-have. Nothing 500s (the route validates + defaults to
   Member); the harm is the new tiers are invisible/unselectable at first-invite. Fix: render from
   `inviteRoleGroups(true)` (the founder onboarding IS the company admin — invites POST after the admin profile
   commits at page.tsx:190, the same reason the old CEO/COO option already worked).

2. **EFFICIENCY/ALTITUDE — R3 put a fetch inside an always-mounted dialog.** R3 called `useCurrentUserRole()` INSIDE
   `InviteMemberDialog`, which is mounted (not conditionally rendered) on the team + chats pages — so every load
   fired an extra auth/profile fetch, and a DUPLICATE on the team page (TeamInner already computes admin status).
   The right altitude is a pure presentational dialog: take `canInviteAdmin` as a prop, computed once by each parent.

## The build (§1.5 — migrate the last surface to the source; lift state to the parent)
- `onboarding/page.tsx` — the invite `<select>` renders tier-grouped `<optgroup>`s from `inviteRoleGroups(true)`.
- `InviteMemberDialog.tsx` — drop the internal `useCurrentUserRole`; add required `canInviteAdmin: boolean` prop;
  `inviteRoleGroups(canInviteAdmin)`. Pure component again.
- `team/page.tsx` — pass `canInviteAdmin={amAdmin}` (already in scope). `chats/page.tsx` — compute
  `amAdmin = isAdminRole(useCurrentUserRole())` once in `TeamChatListInner`, pass it.

Flags-not-blockers (§1.7): the audit's clean categories are recorded in build.md as verified-solid, not silently
dropped — an empty flag list is itself suspicious, so I state what was checked.

## Session-read manifest (A22 — read_at ≥ started_at 10:15:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-08-29T10:15:10+08:00",
    "why_it_governs": "Understand each finding from the record before fixing — the onboarding gap is a real diagnosis, not a guess.",
    "how_this_build_will_embody_it": "Confirmed via the audit sweep WHY the tiers were invisible (unmigrated surface), and WHY the fetch was redundant." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-29T10:15:12+08:00",
    "why_it_governs": "Methodology must be in the tree and read this session before acting.",
    "how_this_build_will_embody_it": "CLAUDE.md sections re-opened via Read this session (§1.7, §5 just now); cited below." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-76", "read_at": "2026-08-29T10:15:20+08:00",
    "why_it_governs": "Holistic — trace the invite-at-tier change across EVERY surface, not just the two I first touched.",
    "how_this_build_will_embody_it": "Swept all of src/; migrated the last hardcoded surface; lifted the dialog's fetch to the parent." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-29T10:15:25+08:00",
    "why_it_governs": "Layer-2 effectivity — the onboarding invite must actually let a founder pick + POST a new tier end-to-end.",
    "how_this_build_will_embody_it": "Verified the POST order (admin profile commits first) so a C-Suite onboarding invite genuinely lands, not just renders." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-08-29T10:15:30+08:00",
    "why_it_governs": "Proactive THINK + search — audit the adjacent surfaces of a just-shipped feature, don't wait for a report.",
    "how_this_build_will_embody_it": "The onboarding gap + the efficiency regression were found by a proactive post-build audit, then fixed." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-262", "read_at": "2026-08-29T10:16:00+08:00",
    "why_it_governs": "Ground-up audit in the outside-view stance, producing honest flags at each layer, on the record.",
    "how_this_build_will_embody_it": "Audited schema→RLS→route→UI as an outsider; recorded solid layers + the two flags; flags informed, didn't block." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-430", "read_at": "2026-08-29T10:16:20+08:00",
    "why_it_governs": "Builder-under-pressure honesty — don't TBC-Exempt a non-trivial change, don't over-claim, don't manufacture.",
    "how_this_build_will_embody_it": "Ran the real ceremony (no exempt shortcut); the efficiency fix is a real regression I introduced, not busywork." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-08-29T10:16:40+08:00",
    "why_it_governs": "Quick-decision checklist before a substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood each finding, traced the ripple (onboarding POST order), verified via the gate." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-08-29T10:16:50+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "CLAUDE.md sections re-opened via Read this session, several just now." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-08-29T10:16:55+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every cited § with a read_at ≥ started_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-08-29T10:17:00+08:00",
    "why_it_governs": "Encode the lesson — the escalation + role-set sync are already gate-pinned; this build adds no new class needing a gate beyond the existing roles.test coverage of inviteRoleGroups.",
    "how_this_build_will_embody_it": "The onboarding surface reuses inviteRoleGroups (already unit-tested); the pure-dialog refactor is typecheck-enforced (required prop)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-08-29T10:17:05+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` exit 0 + test totals." }
]
```
