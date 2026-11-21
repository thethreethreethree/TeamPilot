---
started_at: 2026-11-20T20:00:00Z
trigger: Build-continuation guard (autonomous build active) after Phase 7 closed — RSS plan docs/rss Phase 8 (protection).
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - RSS Phase 8: protection

## The record

- Plan: 07-BUILD-ORDER Phase 8 — apply 0278 (renumbered 0284); audit rows from every sensitive route; retention
  setting read by the purge cron; erasure job; trim with reprocess; redaction only if D15 (open → off).
  05-ROUTES: /settings/retention, /erasure, /[id]/trim. Reference F9.17 (trim: gone from playback, transcript and AI
  after reprocessing; restorable), F31.5, F33.1 (D14 open → no row = keep 20), F33.6.
- The scaffold's policies call rss_is_company_admin / rss_is_manager, which 0272:180 revokes from `authenticated`:
  as written every signed-in read of those tables would error. Live pattern used instead (auth_company_id +
  admin_roles), and no client write policies, as 0282.
- Transcript writers that add a full new version: replace_session_transcript, relabel_session_transcript,
  assign_session_voices, transcriptRecovery (hourly). A trim done as "a trimmed version" would be undone by any of
  them. INVARIANT "transcripts are read from coaching_transcript_segments_current" makes the view the one choke point.
- Erasure: customer phone/email exist only inside transcript text; client_label is the only session field.
  Transcripts are append-only (0070 rules, kept by 0269); agent_point_ledger (0242:30, :77) and
  gamification_calibration (0244:24) reference coaching_sessions without cascade, so a session delete is refused.
  Real erasure deletes; §3.1 says "never update or delete". No plan document resolves that, so the job is not built.

## Outside view

Every Phase 8 feature removes or hides data. The failure to fear is the quiet one: a purge that deletes on a guessed
window, a trim that comes back on the next re-transcribe, a trim hidden from one reader by RLS, an audit log that a
route forgets. Each design choice below is the one that fails loud or not at all.

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-14", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Erasure, trims and retention all delete or hide data; each had to be understood against the record (FKs, append-only rules, the transcript writers) before building.",
   "how_this_build_will_embody_it": "Read the four transcript writers, the session FKs and the rules; executed trim, restore, re-transcribe and the audit trigger on PG 16.4."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "The plan (docs/rss) and the constitution must be in the tree and read this session.",
   "how_this_build_will_embody_it": "07-BUILD-ORDER Phase 7 + gate, 06-UI-SPEC Training, 00-OPEN-DECISIONS D9/D18 read this session; ThinkerThinker assets below read this session."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-80", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Layer 2: a feature whose write errors on every call does not work, whatever its tests say.",
   "how_this_build_will_embody_it": "Four ON CONFLICT writes on rule tables replaced; each write path executed against the schema."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Look past the task: the gate's own detectors can be wrong.",
   "how_this_build_will_embody_it": "INVARIANT 33's ignoreDuplicates exemption and sql-harness's empty-reason probe were both found wrong and fixed."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "434-436", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Checklist item 0: a decision the plan already settles is not put to the founder.",
   "how_this_build_will_embody_it": "D18 follows the plan's stand-in (unmounted, allowlisted with reason), not a picker."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
   "how_this_build_will_embody_it": "Assets opened by line this session; the plan's decisions file decided D18's handling."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "No citation without a session read.",
   "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-775", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "INVARIANT 33 now fails any .upsert on a rule table, ignoreDuplicates included."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1006", "read_at": "2026-11-20T20:37:00Z",
   "why_it_governs": "A verification claim is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md pastes each gate step's exit code; the two Postgres steps are recorded as SKIPPED, not passed."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-343", "read_at": "2026-11-20T20:59:00Z",
   "why_it_governs": "Trims, retention changes and erasure all touch the append-only record.",
   "how_this_build_will_embody_it": "Trims and retention changes are rows; the erasure job is NOT built, because real erasure deletes, which §3.1 forbids without an amendment."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "347-363", "read_at": "2026-11-20T21:20:00Z",
   "why_it_governs": "Erasure deletes; §3.1.1 (AMD-014) is the only rule that permits it, under five conditions.",
   "how_this_build_will_embody_it": "Admin-filed and reviewed (route), personal data only (0285 inventory), facts kept (blanked rows), hashed request + completion row, one door (INVARIANT 38)."}
]
```
