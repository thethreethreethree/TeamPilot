---
started_at: 2026-10-03T05:20:00Z
trigger: An audit of every scheduled job's real runs found coach/kpi/compute-cron answering 504 "Task timed out after 60 seconds" every day from 2026-09-27 to 2026-10-03.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - the KPI job finishes

## The record

- Vercel logs, 7 days: 05:00:40Z 504 "Vercel Runtime Timeout Error: Task timed out after 60 seconds" on each of
  09-27 .. 10-03 (the only scheduled job failing; the others' real runs answer 200).
- Production, read-only: 376 sessions, 12 agents. kpi_snapshot 'current' 70 rows for 12 agents (12 x 6 = 72);
  the latest writes at 05:01:39, one second before the kill.
- The loop: for each agent, 6 metrics x 2 periods, each a delete then an insert, all awaited in sequence:
  24 round trips an agent, 288 in all, about 200 ms each.
- So the kill lands mid-agent, after a delete and before its insert: the last agents lose snapshots daily.
- Readers: /api/coach/kpi/trajectory (manager trajectory), via lib/coach/kpi/trajectory.ts.

## Design

Per agent: one delete over {its metrics} x {current, this month}, then one insert of all 12 rows. A failed
delete skips the insert and is counted. 24 round trips for 12 agents instead of 288.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-03T05:24:30Z",
    "why_it_governs": "Understanding precedes solving: a 504 can be slow data, a slow database or too many calls.",
    "how_this_build_will_embody_it": "Established from the record before changing anything: 7 straight daily 504s at 60 s; only 12 agents and 376 sessions; the last writes land a second before the kill; 70 of 72 'current' rows. So it is the count of round trips, not data size. Printed in full."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-30",
    "read_at": "2026-10-03T05:24:30Z",
    "why_it_governs": "The methodology must be in the tree and read in session.",
    "how_this_build_will_embody_it": "Both documents in the tree, hashes in the front matter; the gate's opening printed at the recorded time."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-92",
    "read_at": "2026-10-03T05:24:30Z",
    "why_it_governs": "Layer 2 asks whether it works for real, not whether its code runs.",
    "how_this_build_will_embody_it": "The job's code was correct and its tests passed; it simply never finished in production. Opening printed."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-150",
    "read_at": "2026-10-03T05:24:30Z",
    "why_it_governs": "Audit as you work; look at the neighbours.",
    "how_this_build_will_embody_it": "Found by auditing every scheduled job's real runs after the outage work, not by a report. Opening printed."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-318",
    "read_at": "2026-10-03T05:24:30Z",
    "why_it_governs": "Branch on the authority's verdict; never re-derive it.",
    "how_this_build_will_embody_it": "A failed clear now stops the insert for that agent instead of being ignored, so a retry cannot duplicate rows. Opening printed."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-345",
    "read_at": "2026-10-03T05:24:30Z",
    "why_it_governs": "History must stay intact: the monthly snapshots are the longitudinal record.",
    "how_this_build_will_embody_it": "The clear still targets only {current, this month}; the test that guards frozen past months is kept and now reads the batched filter. Printed in full."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-437",
    "read_at": "2026-10-03T05:24:30Z",
    "why_it_governs": "Item 0: whether a step needs the founder's pick; item 1: whether the cause is understood from the record.",
    "how_this_build_will_embody_it": "Running the job by hand would write production data, so verification waits for the scheduled run instead of a manual trigger. Items 0-1 printed."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-458",
    "read_at": "2026-10-03T05:24:30Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Heading printed at the recorded time; full text read 2026-10-02 03:59:58Z."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-597",
    "read_at": "2026-10-03T05:24:30Z",
    "why_it_governs": "A citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each entry states its coverage."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-774",
    "read_at": "2026-10-03T05:24:30Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "The round-trip test fails on the old per-row loop (old code: 4 failures). Heading printed."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1004",
    "read_at": "2026-10-03T05:24:30Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check and its exit code in check.md; production success is not claimed until the scheduled run returns 200. Heading printed."
  }
]
```
