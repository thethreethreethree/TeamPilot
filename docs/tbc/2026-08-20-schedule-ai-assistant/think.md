---
title: Schedule Management System — the conversational AI Assistant (headline feature) + clear-schedule
build_plan: ScheduleManagementSystem.md
phase: 4 + 6 (LLM assistant surface; §3.3 guide-don't-overtake)
started_at: 2026-08-20T08:45:00Z
manifest_entries: 12
---

# AI Assistant — a plain-language command surface for the schedule

Founder direction (2026-08-20): the AI-assisted scheduling is the product's biggest selling point, and it was
only embedded in flows (time-off evaluation, import mapping), never a command surface. Build the surface: a
text box where a manager instructs the AI to create/revise/delete/modify schedule elements, and the AI
arranges the schedule — proposing changes the manager confirms (§3.3), never auto-writing.

## Step 2 — Session-read manifest (A22 / §0.1)
```json
[
  { "id": "§0",     "read_at": "2026-08-20T09:05:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",   "why_it_governs": "Understanding precedes solving — I diagnosed WHY the AI felt missing (embedded in flows, no command surface) before building, rather than bolting a chat box onto guesses.", "how_this_build_will_embody_it": "The build adds the missing surface the diagnosis named; the LLM interprets, the deterministic authority decides." },
  { "id": "§0.1",   "read_at": "2026-08-20T09:05:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Precondition gate — methodology in the working tree, read this session.", "how_this_build_will_embody_it": "Ran the document-integrity check first: both docs present + hash-match the manifest before writing a file." },
  { "id": "§1.5.1", "read_at": "2026-08-20T09:05:00Z", "source_file": "CLAUDE.md", "line_range": "78-138",  "why_it_governs": "Four-layer sieve — a chat box is worthless if the write path (apply → append → derived state) is not reachable (layer 2/3).", "how_this_build_will_embody_it": "The write seam is verified reachable: the events route accepts every proposed type + the payloads validate against eventSchema (A31 assertions in build.md)." },
  { "id": "§1.5.2", "read_at": "2026-08-20T09:05:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK hypotheses before grep — the load-bearing risk is the write seam, not the UI.", "how_this_build_will_embody_it": "Hypotheses were written first; H1 (events-route acceptance) was confirmed by reading the route + eventSchema before trusting the flow." },
  { "id": "§2.2",   "read_at": "2026-08-20T09:05:00Z", "source_file": "CLAUDE.md", "line_range": "275-305", "why_it_governs": "Single-source decision — the impact of a proposed change is computed once by the authority and consumed, not re-derived in the assistant.", "how_this_build_will_embody_it": "buildProposal calls evaluateChange (the one authority) for the impact; the clear route consumes readExistingShifts rather than re-deriving 'what shifts exist'." },
  { "id": "§3.1",   "read_at": "2026-08-20T09:05:00Z", "source_file": "CLAUDE.md", "line_range": "215-240", "why_it_governs": "Events are immutable, append-only; 'delete' is a cancellation event, not a row deletion.", "how_this_build_will_embody_it": "Clear-schedule appends SHIFT_CANCELLED for every live shift via the atomic RPC; the assistant's applies are all append events." },
  { "id": "§3.3",   "read_at": "2026-08-20T09:05:00Z", "source_file": "CLAUDE.md", "line_range": "320-331", "why_it_governs": "Guide-don't-overtake (non-negotiable product behavior) — the AI ASKS/PROPOSES, the manager decides; it never takes over the schedule.", "how_this_build_will_embody_it": "Every interpreted action is a PROPOSAL with an Apply button; nothing is appended until the manager confirms. The LLM phrases; the authority computes." },
  { "id": "§3.4",   "read_at": "2026-08-20T09:05:00Z", "source_file": "CLAUDE.md", "line_range": "332-360", "why_it_governs": "Honesty is the moat — no guessed write; fail loud.", "how_this_build_will_embody_it": "parseAssistantReply DROPS a malformed action; an unknown staff name is a BLOCKED proposal (not a guess); an LLM outage is a 502, never a false success." },
  { "id": "§6",     "read_at": "2026-08-20T09:05:00Z", "source_file": "CLAUDE.md", "line_range": "402-430", "why_it_governs": "Reuse — the assistant must not fork the authority or the write path.", "how_this_build_will_embody_it": "It reuses llmCall + the CONVERSATION_IS_DATA fence + evaluateChange + the tested /schedule/events route; no parallel writer." },
  { "id": "A19",    "read_at": "2026-08-20T09:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology in the working tree, read this session.", "how_this_build_will_embody_it": "TT.md in-tree; the cited A-entries were opened + read this session (timestamps here)." },
  { "id": "A22",    "read_at": "2026-08-20T09:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-635", "why_it_governs": "Session-read manifest before closure — citations without reading are undetected violations.", "how_this_build_will_embody_it": "This manifest pairs every cited clause with its in-session read; the tbc:manifest gate enforces it." },
  { "id": "A30",    "read_at": "2026-08-20T09:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-790", "why_it_governs": "A lesson in prose returns; encode it in a gate.", "how_this_build_will_embody_it": "The assistant's parse + write-path shape are locked by tests (route: assign → the two correct events; parse: malformed dropped), so a regression fails the gate." },
  { "id": "A38",    "read_at": "2026-08-20T09:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1020", "why_it_governs": "'Verified' is the canonical command run by name, coverage not verdict.", "how_this_build_will_embody_it": "check.md + closure.md paste npm run check with its exit code (0), not a self-scoped subset." }
]
```

## Understanding
The AI was advisory inside two flows (time-off evaluation, import code-mapping) but there was no place to TYPE
an instruction and have the AI arrange the schedule. The plan (§3.3) is: the AI proposes, the manager decides,
the deterministic authority computes. The build adds `interpretCommand` (LLM, fenced) → `parseAssistantReply`
(validated, drops malformed) → a route that resolves names→ids and evaluates each action via `evaluateChange`
→ a chat page whose proposal cards carry an Apply button that appends the events through the existing,
manager-gated `/schedule/events` route. The delete ask is served by clear-schedule (append-only cancellation).
