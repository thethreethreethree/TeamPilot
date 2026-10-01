---
started_at: 2026-10-01T19:35:00Z
trigger: After deleting the duplicate Vercel project, production's pitch-processing cron began timing out every minute (504 after 300 s, from 19:27:40Z). The investigation found the cause was a paid loop that had been running long before.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - a summary refreshed every minute

## The record

- Every pitch-processing cron run from 19:27:40Z timed out at 300 s; 19:01-19:26 succeeded. No pitch was due.
- Not the database (no active queries, no lock waits), not Supabase or the network (the cron's two REST
  queries answer in under 0.4 s; other Supabase-backed routes answer in under 1.4 s).
- The second query returns completed pitches from the last 24 h: rep 2d03f5e5's latest pitch finished
  2026-09-30 20:09:54, their newest summary is stamped 20:09:10. `isRepDueForRollup` therefore says "due".
- `upsertRepPatternSummary` upserts on (rep_id, period, period_start) without `generated_at`; the column's
  `default now()` applies on INSERT only. A successful refresh rewrites the row and leaves the old time, so the
  rep stays due until the period rolls over: four AI calls a minute (twice while the duplicate project ran).
- `pg_stat_user_tables`: rep_pattern_summaries 80 live rows, 14,142 updates.

## Not yet known

Why the runs started timing out at 19:27 rather than finishing as before. The loop explains why the cron calls
the AI at all; the slowness is in the AI calls (no app logs reach the CLI export). With the fix the cron no
longer calls the AI for this rep, so it should finish in under a second either way.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-01T19:42:43Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "Diagnosed before changing anything: the timeouts were not the DB (no locks, no active queries), not Supabase or the network (REST under 0.4 s), and not pitch work (none due). The record showed one rep permanently 'due' and 14,142 updates over 80 summary rows. Opening lines re-read at the recorded time; full texts read at 13:08Z today."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-10-01T19:42:43Z",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashed in the front matter. Opening lines re-read at the recorded time; full texts read at 13:08Z today."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-10-01T19:42:43Z",
    "why_it_governs": "Four layers; layer 1 is whether the data shape supports the decision built on it.",
    "how_this_build_will_embody_it": "The cost gate compared a column the write never updated. The fix makes the data carry what the gate reads. Opening lines re-read at the recorded time; full texts read at 13:08Z today."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-10-01T19:42:43Z",
    "why_it_governs": "Audit as you work; adjacent problems.",
    "how_this_build_will_embody_it": "Found while checking the effect of deleting the duplicate project; the duplicate was running the same loop. Opening lines re-read at the recorded time; full texts read at 13:08Z today."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-10-01T19:42:43Z",
    "why_it_governs": "A gate whose input drifts from what it assumes defeats itself with every check green; especially before a paid call.",
    "how_this_build_will_embody_it": "rollupDueReps' gate assumes generated_at is the time of the newest refresh; the upsert never wrote it. The test now checks the gate against the real write, not a mock of it. Read at the recorded time, first 19 lines."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "read_at": "2026-10-01T19:42:43Z",
    "why_it_governs": "The checklist, item 0 first.",
    "how_this_build_will_embody_it": "No founder decision: a defect fix to a paid loop. Opening lines re-read at the recorded time; full texts read at 13:08Z today."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-10-01T19:42:43Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Openings printed at the recorded time; full text read at 05:03Z today."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-644",
    "read_at": "2026-10-01T19:42:43Z",
    "why_it_governs": "Citation needs an in-session read.",
    "how_this_build_will_embody_it": "read_at is the print time; coverage stated."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-10-01T19:42:43Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "doorlog.rollupFreshness.test.ts exercises the real upsert and the real gate together; removing the line fails both tests."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-10-01T19:42:43Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check by name, with its exit code, in check.md."
  }
]
```
