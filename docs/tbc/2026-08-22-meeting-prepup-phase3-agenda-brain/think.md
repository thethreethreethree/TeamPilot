---
started_at: 2026-08-22T12:41:00+08:00
---

# THINK — Prep-up Phase 3: the agenda-aware brain (Team-Sync)

The core value of Prep-up: the live Meeting Coach USES the goal + must-discuss topics + document context to run
the meeting to its agenda — hint the next uncovered topic, ground drift in the goal, and alert on a must-discuss
topic still uncovered before the meeting ends. Phases 1 (data/OCR/routes) + 2 (UI) exist; this wires the agenda
into the brain.

## Design (one LLM call does cue + coverage)
- The cue route loads the session's prep (`getMeetingPrepBySession`) + a condensed doc context
  (`getPrepDocContext`) and passes a `MeetingAgenda` (goal + topics-with-coverage + docContext) into the
  strategy via `CoachingContext.agenda`.
- `buildMeetingCueUserMessage` renders the agenda; the meeting system prompt gains the `uncovered_topic` trigger
  and instructs the brain to (a) ground drift in the goal, (b) hint the next NOT-COVERED topic, (c) treat a
  still-uncovered topic near the end as high importance, and (d) return `covered` — the topic IDS it saw
  discussed in THIS window.
- The shared `parseCueDecision` parses `covered` → `CueDecision.coveredTopicIds` (independently of `shouldCue` —
  coverage is reported even on a silent pass). §2.2 single-source: coverage is parsed once, in the shared parse.
- The route merges `coveredTopicIds` into the prep's running `topics[].covered` (`setMeetingPrepTopicsCovered`),
  accumulating across passes — so a covered topic is never re-nudged and the uncovered-before-end alert is
  grounded in the whole meeting. No double-write when nothing changed.

## Honesty (§3.4 / A39)
Coverage + the uncovered alert are grounded in DATA carried WITH the prompt: the topic IDS travel in the agenda
block; the brain reports coverage against those ids — it never guesses topics that weren't given. A prep-less
meeting gets today's agenda-less coaching (the agenda block is omitted entirely — no regression).

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "Understanding precedes solving — coverage is grounded in given topic ids, not reconstructed.",
    "how_this_build_will_embody_it": "The brain reports `covered` against the agenda's ids; no guessing." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read A19/A22/A38/A39 via Read this turn (12:42)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "Layer-2 — the agenda is Prep-up's point; the coach must actually use it.",
    "how_this_build_will_embody_it": "Agenda → cue prompt; hints/drift/uncovered-alert + accumulated coverage." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "Proactive audit — no regression for prep-less meetings; no re-nudge; no double-write.",
    "how_this_build_will_embody_it": "Agenda omitted when absent; covered accumulates; unchanged coverage = no write." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "196-214", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "Single-source — coverage is parsed once in the shared parseCueDecision, consumed as a verdict.",
    "how_this_build_will_embody_it": "coveredTopicIds parsed in the shared parse; the route consumes it, never re-derives." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "327-347", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "Honesty — never fabricate coverage or a topic not given.",
    "how_this_build_will_embody_it": "Coverage is against carried ids; a prep-less meeting shows no agenda." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: reused the parse chokepoint, traced ripple (no non-agenda impact), tested." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this turn." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Tests lock coverage parse, the uncovered_topic trigger, agenda render, + route coverage-persist." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check; exit-0 output in check.md." },
  { "id": "A39", "source_file": "ThinkerThinker.md", "line_range": "1028-1035", "read_at": "2026-08-22T12:42:02+08:00",
    "why_it_governs": "Attribution/data travels WITH the text — topics + coverage are carried, not reconstructed.",
    "how_this_build_will_embody_it": "Topic IDS travel in the agenda block; coverage is reported against them." }
]
```
