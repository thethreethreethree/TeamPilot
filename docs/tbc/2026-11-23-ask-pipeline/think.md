---
started_at: 2026-11-23T00:05:00Z
trigger: Founder 2026-11-23 "keep building everything in the list" — next item, Ask Coach across the pipeline (gong.io capture M36 "Assistant on deal and account boards", graded PARTIAL: Ask Coach spans up to 10 calls only).
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Ask Coach across the pipeline

## The record

- Ask Coach today (src/lib/coach/remote/askCoach.ts; POST /api/coach/remote/ask) answers over 1-10 chosen calls' full
  transcripts with [C#] citations, honouring the `suppressed` verdict from askCoachTurn (src/lib/claude.ts:776).
- The pipeline (Remote Sales → Pipeline, RemotePipeline.tsx) reads remote_prospects_current through listProspects
  (prospects.ts): stage, amount, next call, last call, call count, open to-dos. "Whose pipeline" is mine | team | a rep id.
- Calls link to prospects in remote_prospect_calls (0303, unique per session); each call's brief is in
  remote_call_briefs (key_points, next_steps jsonb of {text, seq}; RLS: own rows or a manager's tree).
- Gong's capture (M36) shows an assistant on deal and account boards answering questions across many deals.

## Outside view

A pipeline question ("which deals are at risk?") needs every prospect at once; ten transcripts cannot hold that. Feeding
all transcripts would be slow and costly and still miss the pipeline facts (amount, next call, to-dos) that answer most
of these questions. Failure modes to fear: an answer about a pipeline the caller cannot see (scope through the service
role); a failed read sent to the AI as "no data" (a confident, billed, wrong answer); invented prospects; an answer left
on screen after switching to someone else's pipeline; a bill growing without limit for a very large pipeline.

## Design

1. Read through the CALLER's client only (cookie or Bearer via callerScopedDb), so RLS decides whose prospects appear.
2. Context per prospect: the pipeline facts plus the latest brief's key points and next steps (not transcripts). Newest
   activity first, capped at 60 prospects; the answer and the screen say when it was capped.
3. Any failed read returns an error before the AI call. The suppression verdict is consumed, not re-derived.
4. [P#] citations resolve only to numbers that were sent; on screen each becomes a button that opens the prospect.
5. UI: one box above the pipeline list with three starter questions; keyed by "whose".

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "Understand before building: what Ask Coach already does (10 transcripts), what the pipeline holds, and which tables a brief lives in were read first.",
    "how_this_build_will_embody_it": "The record section names each source read before the design."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "Layer 3: the answer must lead somewhere — a cited prospect should open, not just be named.",
    "how_this_build_will_embody_it": "Each [P#] renders as a button that opens that prospect on the same page."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T00:28:41Z",
    "why_it_governs": "Holistic: the new route reuses the Ask Coach AI call and the pipeline read, so it must not change either for their existing callers.",
    "how_this_build_will_embody_it": "askCoach.ts, listProspects and the prospects route are unchanged; the feature only adds a reader and a box."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "Look past the task: switching 'Whose pipeline' must not leave an answer about someone else on screen.",
    "how_this_build_will_embody_it": "The box is keyed by the selected pipeline, so switching clears it (F2)."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "No new external config; the AI provider key is the one Ask Coach already uses.",
    "how_this_build_will_embody_it": "Stated in build.md: no new env keys or dashboard settings."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "Suppression is decided once, in the AI call.",
    "how_this_build_will_embody_it": "askPipeline consumes askCoachTurn's `suppressed` verdict; the route and screen branch on it."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "The pipeline state this build reads is derived from appended prospect events; a read-only feature must not introduce an update path.",
    "how_this_build_will_embody_it": "This build only reads: remote_prospects_current (derived from events), links and briefs; nothing is written."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "Erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched; briefs erased under it are simply absent from the read."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "Guide, don't overtake: the coach answers the rep's question about their own pipeline.",
    "how_this_build_will_embody_it": "The answer is advice with named reasons; nothing changes in the pipeline unless the person acts."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "Honesty: the answer must say what it is based on.",
    "how_this_build_will_embody_it": "The screen states it read the prospects' facts and latest call summaries, not full transcripts, and when the pipeline was capped."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "Founder's standing instruction 'keep building everything in the list'; no design choice here needed a new decision."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "The failed-read-stops-before-the-paid-call rule is a test (askPipeline.test.ts)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T00:15:03Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
