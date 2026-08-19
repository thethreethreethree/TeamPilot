---
title: Schedule Management System — company timezone + workweek-start settings
build_plan: ScheduleManagementSystem.md
phase: 5 of 8 (manager interface — date-math settings, RQ4 / RQ7)
started_at: 2026-08-19T23:20:00Z
manifest_entries: 11
---

# Company schedule settings (timezone + workweek-start)

Founder decision (2026-08-19 picker): make timezone + workweek-start real **company settings** (RQ4 / RQ7).
The schedule's date math defaulted to UTC "today" and an ISO-Monday week — wrong for a non-UTC company (a
near-midnight shift lands on the wrong day) or a Sunday/Saturday payroll week (the hours cap + grid bucket on
the wrong boundary).

## Step 2 — Session-read manifest (A22 / §0.1)
```json
[
  { "id": "§0",     "read_at": "2026-08-19T23:25:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",   "why_it_governs": "Understand before solving — traced WHERE tz/workweek actually matter (server 'today', the hours-cap week, the grid columns) before threading, rather than sprinkling a tz library everywhere.", "how_this_build_will_embody_it": "Only the real consumers were threaded; the settings default to UTC/Monday so nothing changes for a company that doesn't set them." },
  { "id": "§0.1",   "read_at": "2026-08-19T23:25:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Precondition gate — methodology in-tree + read this session.", "how_this_build_will_embody_it": "A19/A22/A30/A38 re-read this session (timestamps below)." },
  { "id": "§1.5.1", "read_at": "2026-08-19T23:25:00Z", "source_file": "CLAUDE.md", "line_range": "78-138",  "why_it_governs": "Four-layer — the feature is meaningless without a surface to SET the values (layer 4) and without the migration applied (layer 2).", "how_this_build_will_embody_it": "A Settings tab + page lets a manager set both; migration 0224 APPLIED (verify:live 27/27)." },
  { "id": "§1.5.2", "read_at": "2026-08-19T23:25:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK before searching — reasoned about the reload-jumps-the-week bug + the migration-coupled read's throw path before coding.", "how_this_build_will_embody_it": "The grid sets its initial week from settings ONCE (ref-guarded); getScheduleSettings try/catches a thrown query → defaults." },
  { "id": "§1.5.3", "read_at": "2026-08-19T23:25:00Z", "source_file": "CLAUDE.md", "line_range": "174-195", "why_it_governs": "External-config completeness — the feature depends on a migration AND on the companies UPDATE RLS permitting the manager's write.", "how_this_build_will_embody_it": "Migration 0224 APPLIED; the companies UPDATE policy (id = auth_company_id()) was READ + confirmed to permit the write (same precedent as 0201 default_theme); the reader fails-safe to defaults if the columns are absent." },
  { "id": "§2.2",   "read_at": "2026-08-19T23:25:00Z", "source_file": "CLAUDE.md", "line_range": "275-305", "why_it_governs": "Single-source decision — settings are read once (getScheduleSettings) and CONSUMED; weekStartDay is threaded as a value, not re-derived.", "how_this_build_will_embody_it": "getScheduleSettings is the one reader; weekStartOf/weeklyHoursOf take weekStartDay; the authority/resolution read ctx.weekStartDay; nothing re-computes the week rule." },
  { "id": "§6",     "read_at": "2026-08-19T23:25:00Z", "source_file": "CLAUDE.md", "line_range": "263-283", "why_it_governs": "Reuse — one settings reader + one todayInTz shared across routes + the grid; weekStartOf parameterized rather than forked.", "how_this_build_will_embody_it": "settings.ts is the single source; the coverage/timeoff routes + grid all call it; weekStartOf gained a default param so no caller broke." },
  { "id": "A19",    "read_at": "2026-08-19T23:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology in the working tree, read this session.", "how_this_build_will_embody_it": "TT.md in-tree; cited clauses opened + read this session." },
  { "id": "A22",    "read_at": "2026-08-19T23:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-639", "why_it_governs": "Session-read manifest before closure.", "how_this_build_will_embody_it": "This manifest pairs each cited clause with its in-session read." },
  { "id": "A30",    "read_at": "2026-08-19T23:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-790", "why_it_governs": "A fix is incomplete until gated.", "how_this_build_will_embody_it": "weekStartOf's configurable behavior is detection-proven (reverting the param fails the test); the settings reader's fallbacks + the route auth are unit-tested." },
  { "id": "A38",    "read_at": "2026-08-19T23:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1020", "why_it_governs": "'Verified' is the canonical command actually run.", "how_this_build_will_embody_it": "closure.md pastes npm run check + db:apply verify:live exit codes." }
]
```

## Understanding
tz + workweek-start weren't settings, so the schedule used UTC "today" and an ISO-Monday week everywhere. The
correctness-critical consumers are: the server "today" (current/upcoming time-off filter, coverage-gap
cutoff), the weekly-hours-cap week boundary (authority + resolution), and the grid's week columns + default
week. The fix adds the two company columns, ONE reader with a guarded fallback, threads workweekStart through
weekStartOf (a defaulted param — no caller broke) and timezone through a todayInTz helper (Intl, no
dependency), and gives managers a Settings surface to set them.
