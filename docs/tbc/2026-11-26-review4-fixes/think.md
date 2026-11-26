---
started_at: 2026-11-26T00:23:29Z
trigger: Independent review of ae8bc5cc..4873bde0 (coaching period 90e1001e, KPI headline team cb1926c6) — two confirmed medium, one confirmed low, one plausible low, two nits.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Acting on the fourth review

Honest note on timing: the governing sections were printed at 00:19:26 (before this work) and again at 2026-11-26T00:26:06Z, after the
fixes were written; the manifest records the second, which is the later of the two.

## What the review found, from the record

1. coaching-metrics read calls back 180 + days. The period before starts 2 × days ago, so on its first day it saw calls
   only 180 − days old, while this period sees 180: its counts run low and the arrows lean ▲. My comment claimed the
   opposite — the same "the reason text describes what I meant, not what the code does" shape as review 3's finding.
2. CoachingInbox cleared the numbers on a period change, and the buttons lived inside `metrics?.decided`: a failed load
   took the buttons with it, with no message.
3. KPI page: a refused team (404) left the last data (the whole company) under the picker, and the error banner only
   shows without data.
4. In a team view, quota compared one team's deals with the company's monthly target.
5. Nits: the response-time arrow always said hours; a manager whose only earlier activity was answering had no row.

## Design

1. 180 + 2 × days, with a test that a 300-day-old call is in view for 90 days and not for 30.
2. Keep "decided" and "failed" apart from the numbers; the panel and its buttons stay; a failed period says so.
3. A failed /me drops the last answer, so the error banner shows.
4. Team view: no target; the card says "company target only".
5. Arrow in the unit shown; previous responders get a row.

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "Each finding was traced in the code before changing it; finding 1 in particular is a wrong reason I wrote, so the fix is the arithmetic plus a test, not a new comment.",
   "how_this_build_will_embody_it": "The window is pinned by a test with a call at a chosen age."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-30", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
   "how_this_build_will_embody_it": "Sections printed in full at 00:19:26 and 2026-11-26T00:26:06Z."},
  {"id": "§1.5", "source_file": "CLAUDE.md", "line_range": "64-76", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "Holistic: a wider calls read costs more rows; dropping KPI data on error changes what the page shows on every failure, not only a team's.",
   "how_this_build_will_embody_it": "The calls read is paged (unchanged); every KPI failure now shows the banner, which says what happened."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-100", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "Layer 3: a control that disappears on failure is a dead end.",
   "how_this_build_will_embody_it": "The period buttons stay and the failure is named; a render test clicks back to a working period."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-158", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "Two reviews running found a comment that claimed what the code didn't do.",
   "how_this_build_will_embody_it": "The claim now has a test that fails if the window shrinks."},
  {"id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-180", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "No configuration outside the repository.",
   "how_this_build_will_embody_it": "None needed."},
  {"id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-322", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "The quota target belongs to the company; measuring a team against it re-uses a verdict outside its scope.",
   "how_this_build_will_embody_it": "No target in a team view; the card says why."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "Metrics are derived on read from append-only events; nothing stored.",
   "how_this_build_will_embody_it": "No table or write is added."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "347-361", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "Counts and times only; no customer text.",
   "how_this_build_will_embody_it": "Nothing new for erasure to reach."},
  {"id": "§3.3", "source_file": "CLAUDE.md", "line_range": "368-379", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "A trend biased upward flatters managers — an inaccurate mirror is not guidance.",
   "how_this_build_will_embody_it": "Both periods see the same call ages."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "450-456", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
   "how_this_build_will_embody_it": "No new decision."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-458", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "Methodology in the working tree, consulted not remembered.",
   "how_this_build_will_embody_it": "Assets printed by line this session."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-598", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "A claim without a read: the window comment asserted equal call ages without checking the arithmetic.",
   "how_this_build_will_embody_it": "The arithmetic is tested."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-774", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "Tests for the window, the failed period, the refused team and the unit."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1005", "read_at": "2026-11-26T00:26:06Z",
   "why_it_governs": "Verified is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md names each command with its result."}
]
```
