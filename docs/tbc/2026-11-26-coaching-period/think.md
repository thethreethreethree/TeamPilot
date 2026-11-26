---
started_at: 2026-11-26T00:11:33Z
trigger: Gong ledger F16.8 "Coaching metrics per manager" (P2, PARTIAL) — still missing a choice of period and comparisons for calls listened to and response time.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - A period for coaching metrics, and every column compared

## What the record shows

coaching-metrics/route.ts fixes the window at 30 days and compares only feedback given, calls with feedback and
calls with comments (feedbackTotals). Calls listened to and typical response have no comparison. Team call stats
(team-stats) already offers 7 / 30 / 90 days, so the two Coaching panels can't be read for the same period.
Reading the route also showed: the listen read and the request read are not paged (PostgREST stops at 1000 rows
silently), and the panel's Download CSV link ignores the team picker (it downloads the whole tree).

## Design

- ?days=7|30|90 (default 30; anything else 400). The comparison is the same length of time just before. Calls are
  read back 180 + days so the period before reaches the same call ages (the 210-day rule, generalised).
- Calls listened to per period: each listener's plays of a call within that period, merged, judged by counted() (D8).
- Response time per period: requests made in that period, same requestAnswer rule; an arrow only when both periods
  have answers ("no answers" is not zero hours).
- The by-rep table keeps its 30 days (overdue is defined on 30), so requests are read from the earlier of 2×days or 30.
- Listen and request reads paged by their unique id.
- Panel: 7 / 30 / 90 buttons in the table heading; the heading reads the server's `days`; the metrics have their own
  effect on [team, days], cleared first, late answers dropped; CSV link carries team and period.

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "The ledger gap is a fixed 30-day window and half the columns without a comparison; reading the route showed why (feedbackTotals only covers three counts) and found the unpaged reads and the CSV team gap.",
   "how_this_build_will_embody_it": "The route and panel were read end to end before the change; each gap is fixed at its cause."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-30", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
   "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T00:14:43Z, after started_at."},
  {"id": "§1.5", "source_file": "CLAUDE.md", "line_range": "64-76", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "Holistic: the period touches the feedback window, the calls window, the listen read, the request read and the by-rep table, which has its own 30-day overdue rule.",
   "how_this_build_will_embody_it": "Each window is named separately in the route; the by-rep table is left on 30 days and the request read reaches whichever is earlier."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-110", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "Layer 3: a manager who changes the team or the period and then downloads the CSV must get what is on screen.",
   "how_this_build_will_embody_it": "The CSV link carries team and period (render-tested); the numbers clear on any change so stale ones never sit under a new heading."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "Look past the task: a doubled window makes the unpaged reads' silent 1000-row cap likelier.",
   "how_this_build_will_embody_it": "Both reads are paged by their unique id (invariant 42's rule)."},
  {"id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-180", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "No configuration outside the repository.",
   "how_this_build_will_embody_it": "None needed."},
  {"id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-322", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "Listened is decided by counted() and answered by requestAnswer; the comparison must use the same verdicts, not a second rule.",
   "how_this_build_will_embody_it": "Both periods call the same counted() and responseHoursByManager()."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "The metrics are derived from append-only events on read; nothing is stored or edited.",
   "how_this_build_will_embody_it": "No table or write is added."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "347-361", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "Erasure keeps counts but removes words; these metrics are counts and times only.",
   "how_this_build_will_embody_it": "No customer text is read or shown; nothing new for erasure to reach."},
  {"id": "§3.3", "source_file": "CLAUDE.md", "line_range": "368-379", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "Guide, don't overtake: a comparison is the team's own trend, not a grade.",
   "how_this_build_will_embody_it": "Arrows stay neutral in colour for every column, including response time."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "450-456", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
   "how_this_build_will_embody_it": "No new decision: the periods copy Team call stats' choices."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-458", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "Methodology in the working tree, consulted not remembered.",
   "how_this_build_will_embody_it": "Assets printed by line this session."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-598", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "No citation without a session read.",
   "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-774", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "Route tests for the period and the 400; render tests for the period buttons, the arrows and the CSV link."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1005", "read_at": "2026-11-26T00:14:43Z",
   "why_it_governs": "Verified is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md names each command with its result."}
]
```
