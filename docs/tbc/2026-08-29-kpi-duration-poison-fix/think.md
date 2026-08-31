---
started_at: 2026-08-29T10:31:00+08:00
---

# THINK — KPI avg-session-duration poison fix (the founder-reported "32051.9 min")

## Why (the record — a client-facing failure, verified against LIVE data, not assumed)
The founder sent a screenshot: avg session duration = **32051.9 min** (~534h) and Layer-1 all "building". Last
session claimed this was handled; it was not. So this time the diagnosis is from the LIVE DB, not a theory:
- 359 coaching_sessions; **282 have no audio length** → fall to the wall-clock; **230 have a wall-clock > 6h**.
- The outliers ALL share `ended_at = 2026-08-21T00:28:33.175Z` with `started_at` in June → a **mass backfill**
  closed 200+ old sessions to one timestamp → spans of ~54 DAYS. One of those averaged in = the 32051.9 min.
- `conversationDurationSeconds` (the SINGLE shared rule) trusted `ended_at` with **no upper sanity cap**.
- Second defect found while fixing: `avgSessionDurationMin` summed `?? 0` and divided by ALL ended sessions, so
  a null/excluded duration would be counted as a 0-minute call in the denominator (undercount).

(Layer-1 "building" is a SEPARATE, verified root cause — `coaching_sessions.outcome` is 90% null and has NO
capture path; that is a missing FEATURE, surfaced to the founder as a decision, NOT this build.)

## Understanding (§0, §1.2 record-check, §3.4/§3.5)
The wall-clock is correct for a real live session but meaningless for an unclosed/backfilled one. §3.5: a duration
metric that doesn't match reality is dishonest. §3.4: an unknown must be null (excluded), never a fabricated or
clamped number. The audio-length path (real uploads) is the trusted truth and must NOT be capped.

## The build (§1.5 — one shared helper, so every surface is fixed at once)
- `conversationDuration.ts` — add `MAX_WALLCLOCK_SECONDS` (4h); a wall-clock span beyond it → null (unknown), not a
  poison. Because After-Pitch header + Sessions list + KPI all read this ONE rule (audit F8), all three are fixed.
- `compute.ts avgSessionDurationMin` — average only over sessions with a KNOWN (non-null) duration; a null is
  excluded from BOTH sum and count (not a 0-minute call). Gate on the valid count.

## Gate the lesson (A30)
- `conversationDuration.test.ts`: a >4h/backfilled span → null; a real audio length is NEVER capped.
- `compute.test.ts`: a 90000-min outlier is EXCLUDED — avg reads 30, sampleSize 5, the poison never reaches it.

## Session-read manifest (A22 — read_at ≥ started_at 10:31:00; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-08-29T10:31:02+08:00",
    "why_it_governs": "Understand the bug from the record before fixing — this time from LIVE data, not a repeat of last session's unverified claim.",
    "how_this_build_will_embody_it": "Root cause confirmed by querying the live DB (230 >6h spans, the shared 2026-08-21 backfilled ended_at)." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-29T10:31:06+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md + ThinkerThinker.md re-opened this session; cited below." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-29T10:31:10+08:00",
    "why_it_governs": "Layer-2 effectivity — the metric must show a REAL number end-to-end, verified against data.",
    "how_this_build_will_embody_it": "Fixed at the shared helper + the averager; verified the outliers are excluded via the live-data shape in a test." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-08-29T10:31:14+08:00",
    "why_it_governs": "THINK-first — the averager's denominator bug was found while fixing the cap, not after.",
    "how_this_build_will_embody_it": "Both defects (no cap + count-null-as-0) fixed together, each gated by a test." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-58", "read_at": "2026-08-29T10:32:30+08:00",
    "why_it_governs": "Retrospective identification — diagnose from the actual record (the live DB), not by theorizing forward as last session did.",
    "how_this_build_will_embody_it": "Root cause read off the live data: the 2026-08-21 backfilled ended_at shared by 200+ June-started sessions." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-76", "read_at": "2026-08-29T10:31:20+08:00",
    "why_it_governs": "Holistic — fix at the shared chokepoint so every surface (After-Pitch, Sessions, KPI) is corrected, no drift.",
    "how_this_build_will_embody_it": "The cap lives in the one shared conversationDurationSeconds helper; no per-surface edit." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-08-29T10:34:00+08:00",
    "why_it_governs": "Honesty — an unknown duration must be null (excluded), never a fabricated or clamped number.",
    "how_this_build_will_embody_it": "Over-cap and no-data spans return null and are excluded from the average, not clamped to 4h." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-383", "read_at": "2026-08-29T10:34:20+08:00",
    "why_it_governs": "Measurement rules — meeting duration is a HARD metric; a duration that doesn't match reality is dishonest.",
    "how_this_build_will_embody_it": "The audio-length truth is preserved (never capped); only the unreliable wall-clock is bounded." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-08-29T10:31:18+08:00",
    "why_it_governs": "Quick-decision checklist before a substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood from the record, traced the shared-helper ripple, verified by test + live data." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-08-29T10:31:22+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-08-29T10:31:26+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every cited § with a fresh read_at; the commit trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-08-29T10:31:30+08:00",
    "why_it_governs": "Gate the lesson — a poison-duration must fail a test, not silently return.",
    "how_this_build_will_embody_it": "Two tests lock the cap + the exclusion using the exact live-data shape (54-day span)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-08-29T10:31:34+08:00",
    "why_it_governs": "'Verified' names the command.",
    "how_this_build_will_embody_it": "check.md pastes the real vitest output; the diagnosis pastes the live-DB query results." }
]
```
