# CLOSURE — org-hierarchy ordering (stage 1 of the team reorg)

## What shipped
A canonical org rank in `roles.ts` (six tiers, C-Suite → Frontline) and its application to EVERY team list across
Elostate — the company team, the sales-coach team management, the Care team + Care agents rosters, and the KPI
manager roster (now defaulting its Sort to "Org"). Every roster now reads top-to-bottom by the hierarchy, then A→Z
within a tier, using the same one definition. Auth gates are untouched — this is display order only.

## Verification (A38)
`npm run check` → EXIT 0. The rank + comparator are unit-gated (12 role tests incl. the tier order, existing-vocab
grouping, case-insensitivity, and unknown-sinks-last); the KPI A18 privacy allow-list was updated consciously.

## The un-named reliance
- **Rendered order is founder visual-verify** — jsdom doesn't exercise the live rosters; the sort is the tested
  pure comparator and the wiring is typechecked.
- **With today's data the finer tiers aren't distinguishable yet** — everyone is admin or Member/staff, so the
  visible effect is "leadership first, staff after." The finer tiers rank correctly the instant stage 2 makes them
  assignable.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "STAGE 2 (the rest of the founder-chosen full system): make VP / Director / Manager / Supervisor / CFO assignable — a migration to widen the team_invitations.role CHECK + profiles.role vocabulary, an assignment control (mirror the sales-coach team role dropdown) so admins set each person's tier, and the invite-role dropdown updated. The rank already places them; they just aren't selectable yet.",
    "why_skipped": "Staged deliberately: ordering (safe, no migration) ships first and delivers the 'give it order' ask; the assignable tiers are the next commit.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-29T04:45:00+08:00",
    "outcome": "OPEN — build the assignable tiers + assignment UI next."
  }
]
```
