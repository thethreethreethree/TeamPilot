---
title: Schedule Management System — manager controls (shift-editing + visibility)
build_plan: ScheduleManagementSystem.md
phase: 5 of 8 (manager interface — post-checkpoint controls)
started_at: 2026-08-19T20:00:00Z
manifest_entries: 11
---

# Manager controls: cell-click unassign · manager-only visibility · SHIFT_CANCELLED

Founder decisions (2026-08-19 picker):
- **Shift editing → "Cell-click unassign"** — click a grid cell to remove that person from the shift.
- **Visibility → "Manager-only"** — non-managers are redirected away from every schedule page.
- (Foundation) **SHIFT_CANCELLED** tombstone event — the append-only primitive shift-cancel and the
  chosen "replace-the-week" re-import both need. Built here as a general capability; consumed by the
  re-import build next.

## Step 2 — Session-read manifest (A22 / §0.1)
```json
[
  { "id": "§0",     "read_at": "2026-08-19T20:00:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",   "why_it_governs": "Understanding precedes solving — I traced WHY the gap exists (a manager literally could not remove a mis-assigned person; reads were ungated) from the record before building.", "how_this_build_will_embody_it": "Each feature answers a diagnosed gap, not a guessed enhancement; the fix targets the root (no unassign surface / no page gate), not a symptom." },
  { "id": "§0.1",   "read_at": "2026-08-19T20:15:00Z", "source_file": "CLAUDE.md", "line_range": "22-40", "why_it_governs": "Precondition gate — the methodology defining 'understanding' for this domain must be in the tree AND read this session before substantive build.", "how_this_build_will_embody_it": "TT.md is in-tree; A19/A22/A30/A38 were re-read this session (timestamps below), not cited from cached labels." },
  { "id": "§1.5.1", "read_at": "2026-08-19T20:00:00Z", "source_file": "CLAUDE.md", "line_range": "78-138",  "why_it_governs": "Four-layer / workflow continuity — unassign must leave the manager in a flowing state (grid reloads, coverage re-checks), not a dead end.", "how_this_build_will_embody_it": "Cell-click unassign reloads the grid + the authority re-checks coverage on unassign; the visibility gate redirects cleanly (no broken-button flash)." },
  { "id": "§1.5.2", "read_at": "2026-08-19T20:00:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK before searching — I reasoned about the double-click re-entrancy + the redirect-loop risk before coding.", "how_this_build_will_embody_it": "busyRef latch guards double-submit; the gate note explains why redirecting to /dashboard cannot loop (schedule is not a hard-locked module)." },
  { "id": "§2.2",   "read_at": "2026-08-19T20:00:00Z", "source_file": "CLAUDE.md", "line_range": "275-305", "why_it_governs": "Single-source decision — the page gate must not re-derive 'is a manager', it must consume the same verdict the APIs use.", "how_this_build_will_embody_it": "The layout reuses getCurrentAuthContext().isAdmin (the exact predicate every schedule API's RQ6 gate uses), so page and API cannot drift." },
  { "id": "§3.1",   "read_at": "2026-08-19T20:00:00Z", "source_file": "CLAUDE.md", "line_range": "307-320", "why_it_governs": "Events are immutable / append-only — a cancel must be a NEW event, never an edit or delete of a past one.", "how_this_build_will_embody_it": "SHIFT_CANCELLED is an appended tombstone; the projector deletes the shift from DERIVED state only, the log stays intact (replay reproduces it)." },
  { "id": "§6",     "read_at": "2026-08-19T20:00:00Z", "source_file": "CLAUDE.md", "line_range": "263-283", "why_it_governs": "Reuse over duplication — SHIFT_CANCELLED mirrors the existing COVERAGE_REQ_REMOVED tombstone rather than inventing a new shape.", "how_this_build_will_embody_it": "SHIFT_CANCELLED is a {shiftId} tombstone modelled exactly on COVERAGE_REQ_REMOVED; the grid unassign reuses the existing events POST route + projector." },
  { "id": "A19",    "read_at": "2026-08-19T20:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology in the working tree, read this session.", "how_this_build_will_embody_it": "TT.md is in-tree; the cited clauses were opened and read this session before this manifest was written." },
  { "id": "A22",    "read_at": "2026-08-19T20:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-639", "why_it_governs": "Session-read manifest before closure — a citation without a session read is an undetected violation.", "how_this_build_will_embody_it": "This manifest pairs every cited clause with its in-session read timestamp; the A-clauses were genuinely re-read (not cached) this session." },
  { "id": "A30",    "read_at": "2026-08-19T20:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-790", "why_it_governs": "A lesson/fix is incomplete until encoded in a gate that fails without the author.", "how_this_build_will_embody_it": "SHIFT_CANCELLED's projector behavior + the unassign backbone are locked by deriveState tests (a broken projector fails the gate); the manager-only event-type set is enforced at the route." },
  { "id": "A38",    "read_at": "2026-08-19T20:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1020", "why_it_governs": "'Verified' is a claim about the canonical command actually run.", "how_this_build_will_embody_it": "check.md + closure.md paste `npm run check` output + exit code, not a hand-picked subset." }
]
```

## Understanding (the diagnosed gaps)
1. **No unassign surface.** A manager could create + view shifts but had NO way to remove a mis-assigned
   person — the `EMPLOYEE_UNASSIGNED` event, projector handler, and manager-gated route all existed, but
   nothing in the UI appended it. The grid cell is the natural selector (the person is shown there).
2. **Reads ungated.** Schedule WRITES are manager-only (RQ6), but READS had no page gate — a non-manager
   in a complete-access company could open every page, see write buttons that 403, and see sick time-off.
3. **No shift-cancel primitive.** Append-only cancel (and the founder's chosen replace-the-week re-import)
   both need a tombstone; none existed for shifts (only COVERAGE_REQ_REMOVED existed for requirements).
