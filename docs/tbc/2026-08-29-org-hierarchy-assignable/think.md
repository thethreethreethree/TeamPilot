---
started_at: 2026-08-29T09:00:00+08:00
---

# THINK — assignable org tiers + assignment control (stage 2 of the team reorg)

## Why (the founder's directive + pick)
Stage 1 ordered every roster by the hierarchy. Stage 2 makes the finer tiers ASSIGNABLE. The founder chose (picker)
"the tier IS the role" — reuse the existing `role` field, so C-Suite = admin authority (ADMIN_ROLES), the rest are
not. So assigning a tier is a `profiles.role` write, and admins get a control to set each person's tier.

## Understanding (the constraints — §0)
`profiles.role` has NO check constraint (it can hold any tier value) — so NO migration is needed to store the new
tiers. But `profiles.role` IS a guarded privileged column (0090/0091): a user can't rewrite their own role via
PostgREST — only service-role/definer may. So the set-role write must be service-role + admin-gated + tenant-pinned
(INV15). Inviting AT a new tier would need the team_invitations.role CHECK widened (a migration) — deferred as a
fast-follow; this stage covers re-assigning EXISTING members, the core "assign people to the hierarchy" need.

## The build (§1.5 — reuse the guarded-write + role-dropdown patterns)
- `roles.ts` — `ORG_ROLE_OPTIONS` (the 8 assignable roles grouped by tier) + `ASSIGNABLE_ORG_ROLES` +
  `isAssignableOrgRole`. `CFO` added to `ADMIN_ROLES` (founder: C-Suite = admin) — a CONSCIOUS expansion of a NEW
  value (no existing user is CFO, so no authority drifts); the two pinned admin-set tests were updated deliberately.
- new route `POST /api/team/set-role` — admin-only, service-role, INV15 tenant-pinned (target must be in the
  caller's company; the write is company-scoped). SAFETY: refuses a demotion that would remove the company's LAST
  admin (409) — an unrecoverable lockout. Mirrors add-member's guarded-write posture.
- `dashboard/team/page.tsx` — an admin-only org-role `<select>` per member (mirrors the sales-coach role dropdown),
  posting to set-role; the member line now reads the TIER label (`orgTierLabel`) instead of the raw role string.

## Session-read manifest (A22 — read_at ≥ started_at 09:00:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-29T09:01:00+08:00",
    "why_it_governs": "Understand the guarded-column + constraint reality before choosing a migration vs no-migration path.",
    "how_this_build_will_embody_it": "Confirmed profiles.role has no CHECK (no migration) but is guarded (service-role write)." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-29T09:01:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-29T09:01:10+08:00",
    "why_it_governs": "Organic + Holistic — reuse the roles module + the add-member guarded-write pattern; trace the ADMIN_ROLES ripple.",
    "how_this_build_will_embody_it": "Assignable vocab in roles.ts; set-role mirrors add-member; the CFO change swept its pinned tests." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-29T09:01:15+08:00",
    "why_it_governs": "Layer 2 — the assignment must actually persist + gate correctly end-to-end.",
    "how_this_build_will_embody_it": "The route is unit-tested (auth, tenant-pin, last-admin, happy); the dropdown posts to it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-29T09:01:18+08:00",
    "why_it_governs": "THINK-first — the last-admin lockout is the non-obvious failure to guard before shipping a role-change control.",
    "how_this_build_will_embody_it": "Refuses removing the company's only admin (409), tested both branches." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-354", "read_at": "2026-08-29T09:01:20+08:00",
    "why_it_governs": "Guide-don't-overtake — reuse-role vs separate-field was the founder's pick; C-Suite=admin their choice.",
    "how_this_build_will_embody_it": "Built the same-field option; admin set = C-Suite; surfaced the choice as a picker." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-29T09:01:25+08:00",
    "why_it_governs": "Honesty — a failed/last-admin change must say WHY, never silently succeed or lock out.",
    "how_this_build_will_embody_it": "409 names the lockout ('promote someone first'); a write error surfaces, never a false success." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-29T09:01:30+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood the constraints, reused patterns, guarded the lockout, kept tenant-pin." },
  { "id": "A13", "source_file": "ThinkerThinker.md", "line_range": "330-330", "read_at": "2026-08-29T09:01:35+08:00",
    "why_it_governs": "One role vocabulary — the assignable set + admin set live in roles.ts, consumed everywhere.",
    "how_this_build_will_embody_it": "ORG_ROLE_OPTIONS + ADMIN_ROLES authored once; auth-helpers re-exports the same ADMIN_ROLES." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-29T09:01:40+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-29T09:01:45+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-29T09:01:50+08:00",
    "why_it_governs": "Gate the lesson — the security + last-admin safety must be tested, both branches.",
    "how_this_build_will_embody_it": "set-role route test: 401/403/400/404/409 + two 200 paths (demote-with-spare, non-demotion)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-29T09:01:55+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + exit code." }
]
```
