---
title: Schedule Management System — Phase 5 part 1 (Roster API)
build_plan: ScheduleManagementSystem.md
phase: 5 of 8 (first surface — roster write path)
started_at: 2026-08-19T00:00:00Z
manifest_entries: 10
---

# Phase 5 (part 1) — Roster API

## Step 2 — Session-read manifest (A22 / A35)
```json
[
  { "id": "§0",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",  "why_it_governs": "Understand why the write path exists before building it — the roster was flagged in Phase 2 as PENDING (no writer); this is that writer.", "how_this_build_will_embody_it": "The API closes the Phase-2 S2 write-path gap deliberately, not incidentally." },
  { "id": "§0.1",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",  "why_it_governs": "Governing methodology in-tree + read this session.", "how_this_build_will_embody_it": "Docs hash-matched; assets opened this session." },
  { "id": "§1.5.1", "read_at": "2026-08-19T00:51:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer — the roster API (layer 1-2) is the seam the manual add-form + the file-upload (layer 3-4) both write through; build it sound first.", "how_this_build_will_embody_it": "One tested write path both UI surfaces reuse (no duplicate roster writers to drift)." },
  { "id": "§1.5.2", "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK about how a write route fails before coding.", "how_this_build_will_embody_it": "Hypotheses on the authz gap (RQ6) + tenant-pin + honest read error, then the tests that lock them." },
  { "id": "§3.4",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "332-343", "why_it_governs": "Honesty — a failed read must not read as an empty roster.", "how_this_build_will_embody_it": "GET try/catch returns a real 500, never a false empty; the paged read avoids the 1000-row silent truncation." },
  { "id": "§6",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "402-440", "why_it_governs": "Checklist — trace what a write affects; guard tenant scope.", "how_this_build_will_embody_it": "company_id is server-resolved (tenant-pin); writes are manager-gated." },
  { "id": "A19",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology in-tree + read.", "how_this_build_will_embody_it": "Assets opened this session." },
  { "id": "A22",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-631", "why_it_governs": "Citations require reading.", "how_this_build_will_embody_it": "This manifest." },
  { "id": "A30",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-789", "why_it_governs": "A lesson in prose returns — a fix is not complete until the class is encoded in a gate that fails without the author's cooperation.", "how_this_build_will_embody_it": "6 tests lock the manager gate (RQ6) + tenant-pin; a regression that lets a non-manager write, or trusts body.companyId, fails CI." },
  { "id": "A38",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1021", "why_it_governs": "Verified = the command by name.", "how_this_build_will_embody_it": "check.md pastes npm run check + exit code." }
]
```
Also embodied (read this session): the INV18 mutation-route-auth class + the tenant-pin rule (RQ6/S2 from Phase 2).

## Step 3 — Hypotheses (§1.5.2)
- **H1 anon/non-manager write** (RQ6). Mitigation: getCurrentAuthContext + `if (!ctx.isAdmin) 403`; test asserts a Member gets 403 + no write.
- **H2 tenant escalation via body.companyId.** Mitigation: company_id is `ctx.companyId`, never the body; test passes a hostile body.companyId and asserts the insert used the session's.
- **H3 read error as empty roster.** Mitigation: GET try/catch → 500; paged read (no 1000 truncation).

## Step 4 — Spec fidelity
Phase 5's first surface per the founder picker (roster + file upload, data-first). This build is the roster WRITE
PATH (the API); the manual add-form UI, the grid schedule view, the file-upload parser, and the review queue are
the remaining Phase-5 units.

## Step 5 — Four-layer
1: one tested write path, tenant-pinned, manager-gated. 2: behaves as a manager/import caller would. 3: consumer
is the Phase-5 add-form + file-upload (next units). 4: the UI surface is the next unit. **SHIPPABLE foundation.**
