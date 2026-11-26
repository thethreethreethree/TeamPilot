---
started_at: 2026-11-26T00:29:45Z
trigger: Found while planning F12.7 (followed-search notices): the bell that carries every notice is mounted only on the Scoreboard page, as `{isManager && <NotificationBell />}` — reps never see the notices written to them.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The bell is everyone's

Honest note on timing: the gap was found and the change written between 00:23 and 00:29; the governing sections were
printed at 00:19:26 and 00:26:06 (before) and again at 00:29:46–2026-11-26T00:29:52Z for this record.

## What the record shows

- NotificationBell's own header (2026-09-21): "NO LONGER MANAGER-ONLY … now also carries pitch_score_corrected to the
  REP". Since then rep-addressed types were added: call_ready, call_scored (322df56d, F15.13), dispute_answered,
  comment_mention, call_access_granted (grantee), pattern_coached …
- `grep -rn "<NotificationBell" src`: one mount, Scoreboard.tsx:118, `{isManager && <NotificationBell />}`, and only on
  /dashboard/sales-coach/scoreboard. No other UI reads manager_notifications.
- So every rep notice since September was written for nobody, and managers saw theirs only on one page. Production
  holds 0 notifications today (probe, counts), so nobody has missed one yet.
- Cause: the bell was born manager-only (3391bd38) and mounted on the manager's page; when its audience widened, its
  mount wasn't revisited — each feature tested that the notice is WRITTEN and that the bell RENDERS it, never that a rep
  can reach the bell.

## Design

Mount it in both module shells for everyone: Remote Sales header (right); Sales Coach sidebar brand row on desktop
(panel opens right, dark tone) and a top-right chip on phones (no sidebar); remove Scoreboard's copy (no duplicates).
A source test refuses a bell behind a manager check and requires both shells to mount it.

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "Before building notices for followed searches I checked who can see the bell at all, and the record (one manager-only mount) says the existing notices reach no rep.",
   "how_this_build_will_embody_it": "The cause (mount not revisited when the audience widened) is fixed with a gate, not only a move."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-30", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
   "how_this_build_will_embody_it": "Sections printed at 00:19:26, 00:26:06 and 2026-11-26T00:29:52Z."},
  {"id": "§1.5", "source_file": "CLAUDE.md", "line_range": "64-76", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "Holistic: the bell subscribes to Realtime and polls every 60 s; mounting it in two shells must not double that for one person.",
   "how_this_build_will_embody_it": "One bell per shell, and a person is in one shell at a time; the Scoreboard copy (inside the Sales Coach shell) is removed."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-100", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "Layer 2 and 3: a notice written but unreachable does not deliver the result; the rep is left not knowing their call was scored.",
   "how_this_build_will_embody_it": "A render test: a rep (not a manager) gets the bell with their unread count."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-158", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "Search adjacent: if the bell is unreachable, every feature that relies on it is too.",
   "how_this_build_will_embody_it": "All notice types checked against the one mount; the source test covers any future mount."},
  {"id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-180", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "Realtime is Supabase config; the 60 s poll already covers it being off.",
   "how_this_build_will_embody_it": "No new external dependency."},
  {"id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-316", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "Who receives a notice is decided by RLS (recipient_id = auth.uid()); the mount re-derived it as 'managers only'.",
   "how_this_build_will_embody_it": "The mount no longer judges; the recipient rule alone decides what shows."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "No data change; notices are read as before.",
   "how_this_build_will_embody_it": "No table or write is added."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "347-361", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "Notification excerpts are already in erasure (0316); showing them to their recipient changes nothing there.",
   "how_this_build_will_embody_it": "No new stored text."},
  {"id": "§3.3", "source_file": "CLAUDE.md", "line_range": "368-379", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "A rep told their score with 'what went well and your next step' is the guidance loop; unseen, it isn't one.",
   "how_this_build_will_embody_it": "The rep can now read it."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "450-456", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
   "how_this_build_will_embody_it": "No decision: the bell was already declared everyone's (2026-09-21); only its mount lagged."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-458", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "Methodology in the working tree, consulted not remembered.",
   "how_this_build_will_embody_it": "Assets printed by line this session."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-598", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "No citation without a session read.",
   "how_this_build_will_embody_it": "Every id here was printed at its line range this session."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-774", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "bellMounted.test.ts refuses a manager-gated bell and requires both shells to mount it."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1005", "read_at": "2026-11-26T00:29:52Z",
   "why_it_governs": "Verified is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md names each command with its result."}
]
```
