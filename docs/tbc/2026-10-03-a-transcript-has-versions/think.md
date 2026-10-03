---
started_at: 2026-10-03T06:58:00Z
trigger: Founder picker 2026-10-03, "Keep history: add versions", after an audit of 7 days of 5xx found a transcript relabel failing on a duplicate key and traced it to the append-only rules.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - a transcript has versions

## The record

- Vercel logs: POST label-transcript 500 on 2026-09-28, "[salesCoach.replaceSessionTranscript] failed
  session=9cab5307…: duplicate key value violates unique constraint coaching_transcript_segments_session_seq_unique";
  the hourly recover-transcripts-cron failing the same way on 9cab5307 (10) and 8bde1ce2 (8) in 7 days.
- Hypotheses, in order, and what disproved them:
  1. the client sent duplicate seq: every server path numbers segments `seq: i` from one response;
  2. two concurrent replaces: session 9cab5307 still holds only its 16:17 segment, so no replace ever landed;
  3. a trigger blocks the delete: none on the table.
  The cause: `pg_rules` shows `coaching_transcript_segments_no_delete … DO INSTEAD NOTHING` and `_no_update`
  (0070). replace_session_transcript (0212, 2026-08-14) deletes then inserts; the delete does nothing, the insert
  collides. 0208 knew the rule (it lifted and restored it); 0212 did not account for it.
- /attribute-unlabelled relabels with `.update()`: the rule makes it a no-op and the route answers "attributed".
  Production has never had a segment with source 'manual'.
- Production, read-only: 31 sessions with a recovery attempt; 13 have rep speech now; 12 (2 companies, all with
  audio) have segments but no rep speech and cannot be repaired; 6 have no segments.
- Readers: 13 website reads, 3 in the app (sync/sessions.ts, incl. an embedded count). The only SQL reader is the
  replace function. No views on the table, no realtime.

## What the founder chose

Keep history: a repair writes a new version, the old one stays; every reader reads the newest version.

## Design

Migration 0269 (version column; unique per version; an insert trigger for writes that name no version; the
`coaching_transcript_segments_current` view, security_invoker; replace and relabel functions that append a
version under a per-session lock). Website reads and the app's reads move to the view; INVARIANT 32 and an app
test keep them there. Rollout: apply 0269 (founder's go-ahead), deploy the website at once, confirm the app's
embedded count works against the view, ship app build 30, then re-run recovery on the 12.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-03T06:58:26Z",
    "why_it_governs": "Understanding precedes solving: three wrong guesses (client duplicates, concurrency) came before the cause.",
    "how_this_build_will_embody_it": "The cause was found in the database, not the code: the 0070 no_delete / no_update rules turn the repair's DELETE and the relabel's UPDATE into nothing. Every hypothesis before that is recorded in think.md with what disproved it. Printed in full."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-33",
    "read_at": "2026-10-03T06:58:26Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter; the gate printed at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-10-03T06:58:26Z",
    "why_it_governs": "Four layers; layer 3 asks what the rep can do next after the feature acts.",
    "how_this_build_will_embody_it": "After a repair or a relabel the rep's call must show one transcript and be coachable; the view gives the newest version to every reader, web and app. Printed in full."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-10-03T06:58:26Z",
    "why_it_governs": "Audit as you work; the bug rarely lives alone.",
    "how_this_build_will_embody_it": "Following one 500 found the repair broken since 2026-08-14, the relabel broken since it shipped, and 12 stuck calls. Printed in full."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-10-03T06:58:26Z",
    "why_it_governs": "One source for a decision; readers consume it.",
    "how_this_build_will_embody_it": "Which version is current is decided once, in the view; no reader computes max(version) itself. INVARIANT 32 keeps every read on the view. Printed in full."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-10-03T06:58:26Z",
    "why_it_governs": "Append-only; full history intact.",
    "how_this_build_will_embody_it": "The founder's pick keeps the rules: nothing is deleted or updated; a repair and a relabel each append a version. Printed in full."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-446",
    "read_at": "2026-10-03T06:58:26Z",
    "why_it_governs": "Item 0: a founder decision goes through the picker; item 4: is the constraint real?",
    "how_this_build_will_embody_it": "The constraint (append-only) is real and kept; how to repair under it was the founder's pick (versions). Items 0-5d printed."
  },
  {
    "id": "A12",
    "source_file": "ThinkerThinker.md",
    "line_range": "293-310",
    "read_at": "2026-10-03T06:58:32Z",
    "why_it_governs": "A migration must be safe to re-run against a partial state.",
    "how_this_build_will_embody_it": "Every step in 0269 is if-exists / if-not-exists / or-replace; the migration audit's re-run pass is clean. Printed in full."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-10-03T06:58:32Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Opening printed at the recorded time; full text read 2026-10-02 03:59:58Z."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-600",
    "read_at": "2026-10-03T06:58:32Z",
    "why_it_governs": "A citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry states its coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-778",
    "read_at": "2026-10-03T06:58:32Z",
    "why_it_governs": "A view without security_invoker reads past RLS; a fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "The view is security_invoker (the probe checks a foreign rep sees nothing through it); INVARIANT 32 and the app test fail on a raw read. Opening printed; full text read 2026-10-02."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-10-03T06:58:32Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check and the app gate, with exit codes, in check.md. Opening printed."
  }
]
```
