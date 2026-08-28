---
started_at: 2026-08-29T04:30:00+08:00
---

# THINK — org-hierarchy ordering across Elostate (stage 1 of the team reorg)

## Why (the founder's directive)
The founder: the team system is disorganized throughout Elostate; revise it to a role-organization ORDER, top to
bottom — C-Suite → VP → Director → Manager → Supervisor/Team Lead → Frontline. They chose (picker) the full
assignable 6-tier system. This is STAGE 1: the canonical rank + applying the ordering everywhere a team is listed.
Stage 2 (the new assignable tiers + assignment UI + migration) follows.

## Understanding (the existing role model — §0)
`src/lib/roles.ts` already authors the role vocabulary once (§A13): INVITABLE_ROLES = CEO/COO/Lead/Member,
ADMIN_ROLES = CEO/COO/admin. Live data is mostly admin vs Member/staff. So the org axis PARTLY exists (CEO/COO/Lead
outrank Member) — it just has no canonical ORDER and no finer tiers. Team rosters sort alphabetically by name.

## The build (§1.5 — one definition, consumed by reference)
- `roles.ts` — `orgRoleRank(role)` maps every role value into one of six tiers (0=C-Suite … 5=Frontline; unknown/
  null → below Frontline), case-insensitive so the 'Member'/'member' split ranks alike; `byOrgRank(getRole,getName)`
  comparator (tier, then A→Z within tier); `orgTierLabel`. The org axis is DISTINCT from ADMIN_ROLES (authority) —
  a Director isn't an admin but outranks a Manager.
- Applied to EVERY team list (§1.5.1 — throughout): the company team (`data/team.ts fetchTeam`), the sales-coach
  team management route, the Care team + Care agents-settings routes, and the KPI manager roster (API returns
  org-ordered + exposes `companyRole`; the page defaults its Sort to "Org", keeping name/conversion/reliance).

## Scope discipline
Stage 1 uses EXISTING roles, so it orders correctly today (admins/leadership first, members after) and normalizes
the casing mess — without a migration or new UI. The finer tiers (VP/Director/Manager/Supervisor/CFO) rank
correctly the instant they exist (stage 2). The KPI roster's new `companyRole` is an org label, not a performance
score, so the §A18 privacy allow-list was updated consciously.

## Session-read manifest (A22 — read_at ≥ started_at 04:30:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-29T04:31:00+08:00",
    "why_it_governs": "Understand the existing role vocabulary before adding a hierarchy — don't duplicate it.",
    "how_this_build_will_embody_it": "Read roles.ts; extended the single source with a rank, not a parallel role list." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-29T04:31:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-29T04:31:10+08:00",
    "why_it_governs": "Organic + Holistic — one rank definition, consumed by every roster; trace all team-list surfaces.",
    "how_this_build_will_embody_it": "byOrgRank authored once in roles.ts; grepped + wired every team list that sorted by name." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-29T04:31:15+08:00",
    "why_it_governs": "Throughout the whole system — the order must read the same on every surface, not one.",
    "how_this_build_will_embody_it": "Company team, sales-coach team, Care team, Care agents, KPI roster all sort by the same rank." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-29T04:31:18+08:00",
    "why_it_governs": "THINK-first then search — before adding a rank, sweep every surface that lists a team so none is left inconsistent.",
    "how_this_build_will_embody_it": "Grepped all team-list routes/pages; wired each of the five to the same rank." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-354", "read_at": "2026-08-29T04:31:20+08:00",
    "why_it_governs": "Guide-don't-overtake — the scope (full assignable system vs ordering-only) was the founder's pick.",
    "how_this_build_will_embody_it": "Surfaced the scope as a picker; this stage 1 is the ordering half of the chosen full build." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-29T04:31:25+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood the existing vocab, reused it, traced every roster, kept the privacy guard." },
  { "id": "A13", "source_file": "ThinkerThinker.md", "line_range": "330-330", "read_at": "2026-08-29T04:31:30+08:00",
    "why_it_governs": "Author a vocabulary ONCE — the rank belongs in the roles module, not re-derived per surface.",
    "how_this_build_will_embody_it": "orgRoleRank/byOrgRank live in roles.ts; every surface imports them." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "57-57", "read_at": "2026-08-29T04:31:32+08:00",
    "why_it_governs": "The KPI rollup exposes derived aggregates, never a rep's raw per-session scores.",
    "how_this_build_will_embody_it": "The added companyRole is an ORG LABEL, not a score; the A18 allow-list test was updated consciously and its raw-leak assertions still pass." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-29T04:31:35+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-29T04:31:40+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-29T04:31:45+08:00",
    "why_it_governs": "Gate the lesson — the rank order + case-insensitivity + unknown-sinks-last must be tested.",
    "how_this_build_will_embody_it": "12 role tests: tier order, existing-vocab grouping, case-insensitivity, unknown→bottom, byOrgRank." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-29T04:31:50+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + exit code." }
]
```
