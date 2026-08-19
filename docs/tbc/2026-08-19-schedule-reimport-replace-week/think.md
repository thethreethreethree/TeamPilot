---
title: Schedule Management System — replace-the-week re-import
build_plan: ScheduleManagementSystem.md
phase: 5 of 8 (import — re-import semantics)
started_at: 2026-08-19T20:00:00Z
manifest_entries: 13
---

# Replace-the-week re-import

Founder decision (2026-08-19 picker): re-importing the same week must **replace-the-week** — supersede the
existing shifts in the imported date span, then add the new ones (atomically). Previously a re-import APPENDED,
stacking duplicate shifts on top of the originals.

## Step 2 — Session-read manifest (A22 / §0.1)
```json
[
  { "id": "§0",     "read_at": "2026-08-19T22:30:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",   "why_it_governs": "Understanding precedes solving — the append-duplicate behavior was diagnosed from the record (the tracked idempotency gap) before choosing the replace semantic.", "how_this_build_will_embody_it": "The fix targets the diagnosed root (no supersede step), and the span semantic is the founder's explicit pick, not a guess." },
  { "id": "§0.1",   "read_at": "2026-08-19T20:15:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Precondition gate — methodology in-tree + read this session before substantive build.", "how_this_build_will_embody_it": "A19/A22/A30/A38 re-read this session (timestamps below); TT.md in-tree." },
  { "id": "§1.5.1", "read_at": "2026-08-19T22:30:00Z", "source_file": "CLAUDE.md", "line_range": "78-138",  "why_it_governs": "Four-layer — layer 2 (does it work end-to-end) and layer 4 (surface). The migration must be APPLIED for the feature to work, and the manager must SEE the replace before confirming.", "how_this_build_will_embody_it": "Migration 0223 applied + verify:live 27/27 (layer 2); the preview warns 'replaces N shifts' (layer 4)." },
  { "id": "§1.5.2", "read_at": "2026-08-19T22:30:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK before searching — reasoned about the deploy-before-migrate window and the preview/commit TOCTOU before coding.", "how_this_build_will_embody_it": "Guarded fallback for the un-applied migration; the commit recomputes the supersede set authoritatively so a stale preview count never mis-writes." },
  { "id": "§1.5.3", "read_at": "2026-08-19T22:30:00Z", "source_file": "CLAUDE.md", "line_range": "174-195", "why_it_governs": "External-config completeness — the feature depends on a migration outside the code; 'the code is correct' is not 'it works' until the migration is applied.", "how_this_build_will_embody_it": "Migration 0223 was APPLIED via npm run db:apply (verify:live passed), and the code FAILS LOUD (503) rather than silently appending if the migration is ever absent." },
  { "id": "§2.2",   "read_at": "2026-08-19T20:00:00Z", "source_file": "CLAUDE.md", "line_range": "275-305", "why_it_governs": "Single-source decision — the supersede set is decided ONCE (TypeScript) and consumed by the RPC + the preview; never re-derived in SQL.", "how_this_build_will_embody_it": "supersededShiftIds is the single source; the RPC only applies the passed ids; the preview count uses the same function so it can't drift from the commit." },
  { "id": "§3.1",   "read_at": "2026-08-19T20:00:00Z", "source_file": "CLAUDE.md", "line_range": "307-319", "why_it_governs": "Events immutable / append-only — a supersede must be an appended SHIFT_CANCELLED, never a delete.", "how_this_build_will_embody_it": "The RPC appends SHIFT_CANCELLED (the projector drops the shift from derived state); the log stays intact." },
  { "id": "§3.4",   "read_at": "2026-08-19T22:30:00Z", "source_file": "CLAUDE.md", "line_range": "332-343", "why_it_governs": "Honesty — a replace deletes existing shifts; the manager must not be surprised.", "how_this_build_will_embody_it": "The preview surfaces willReplace (N) BEFORE commit; the result reports shiftsSuperseded AFTER — never a silent delete." },
  { "id": "§6",     "read_at": "2026-08-19T20:00:00Z", "source_file": "CLAUDE.md", "line_range": "263-283", "why_it_governs": "Reuse over duplication — one commit helper, one existing-shifts read, shared by CSV + VA and by preview + commit.", "how_this_build_will_embody_it": "commitImport + readExistingShifts are shared by both formats and both phases; the two commit routes lost their duplicated RPC block." },
  { "id": "A19",    "read_at": "2026-08-19T20:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology in the working tree, read this session.", "how_this_build_will_embody_it": "TT.md in-tree; the cited clauses opened + read this session." },
  { "id": "A22",    "read_at": "2026-08-19T20:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-639", "why_it_governs": "Session-read manifest before closure.", "how_this_build_will_embody_it": "This manifest pairs each cited clause with its in-session read timestamp." },
  { "id": "A30",    "read_at": "2026-08-19T20:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-790", "why_it_governs": "A fix is incomplete until encoded in a gate that fails without the author.", "how_this_build_will_embody_it": "supersededShiftIds is locked by unit tests (span/mid-span/first-import/single-day); the route tests lock the passed cancel ids + shiftsSuperseded; verify:live re-runs on the migration." },
  { "id": "A38",    "read_at": "2026-08-19T20:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1020", "why_it_governs": "'Verified' is the canonical command actually run.", "how_this_build_will_embody_it": "closure.md pastes npm run check + db:apply verify:live exit codes." }
]
```

## Understanding
Re-importing a corrected week appended a second copy of every shift (append-only, import-once assumed). The
founder chose replace-the-week: a re-import supersedes the existing shifts in the imported date SPAN, then
adds the new ones. Span (not exact-date-set) is deliberate — a corrected week that drops a mid-week shift must
clear the old one. The decision of WHICH shifts to supersede is computed once in TypeScript (the projector is
the single source of live shifts) and applied atomically by the RPC, so preview and commit can't disagree.
