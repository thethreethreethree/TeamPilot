---
started_at: 2026-10-01T13:40:00Z
trigger: Production, read-only 2026-10-01 - the first scoring run left 92 recordings unscored in one company, all with no rep speech; the panel would offer "Score them all" for them indefinitely.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - a button for what can be scored

## The problem, from the record

- Production: of 317 unscored sales sessions, 203 have no rep transcript line; in company 28203036 it is all
  92 that remain. generatePitchScore refuses those (`no_agent_turns`, MIN_AGENT_SEGMENTS = 1) before any AI
  call, every time.
- The count route returned every unscored session, so the panel read "92 recordings have never been scored"
  with a button that can score none, and, by its own design, would never disappear.
- After a run, the panel's headline followed the drain's `remaining`, which includes the same recordings.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-10-01T13:45:20Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The defect came from production first: 92 of 92 unscored recordings in one company have no rep speech; the scorer's rule (generatePitchScore, MIN_AGENT_SEGMENTS) was read before the count was changed. Opening lines re-read at the recorded time; full text read at 13:08Z today."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-10-01T13:45:20Z",
    "why_it_governs": "Methodology in the working tree at the moment of action.",
    "how_this_build_will_embody_it": "Both governing documents are in the tree and hashed in the front matter. Opening lines re-read at the recorded time; full text read at 13:08Z today."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-10-01T13:45:20Z",
    "why_it_governs": "Four layers in order; layer 2 is whether the button does what it offers.",
    "how_this_build_will_embody_it": "L2: the button is offered only for recordings a press can score. L3: after a run the panel recounts, so it never ends on a backlog it cannot touch. L4: the new line captured and opened in both themes. Opening lines re-read at the recorded time; full text read at 13:08Z today."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-10-01T13:45:20Z",
    "why_it_governs": "Audit as you work; surface adjacent problems.",
    "how_this_build_will_embody_it": "Found while checking what last night's first scoring run did; the panel's post-run headline had the same flaw and is fixed with it. Opening lines re-read at the recorded time; full text read at 13:08Z today."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-10-01T13:45:20Z",
    "why_it_governs": "A re-derived decision must mirror its authority term for term, with a drift guard on both branches.",
    "how_this_build_will_embody_it": "The count re-derives the scorer's no_agent_turns rule as a query, unavoidably (it must count without grading). It compares each session's rep-line count with the scorer's own exported MIN_AGENT_SEGMENTS, reads through the same client, and a test runs both branches at exactly the threshold and one below it. Read in full at the recorded time."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "read_at": "2026-10-01T13:45:20Z",
    "why_it_governs": "The checklist, item 0 first.",
    "how_this_build_will_embody_it": "No founder decision: the panel's own design already says it disappears when there is nothing to do. Opening lines re-read at the recorded time; full text read at 13:08Z today."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-10-01T13:45:25Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Opening paragraphs printed at the recorded time; full text read at 05:03Z today."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-644",
    "read_at": "2026-10-01T13:45:25Z",
    "why_it_governs": "Citation needs an in-session read.",
    "how_this_build_will_embody_it": "Each read_at is the time of a print after this build began; what each print covered is stated."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-10-01T13:45:25Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "Route and panel tests fail on the old count and on a threshold copied as '>' (mutations caught)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-10-01T13:45:25Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check by name, with its exit code, in check.md."
  }
]
```
