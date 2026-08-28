---
started_at: 2026-08-28T11:30:00+08:00
---

# THINK — Role Play from a recorded pitch

## Why (the founder's feature + pick)
Founder: when a rep fumbles a pitch / can't answer an objection and the customer doesn't sign up, they should be
able to click "Role Play" on that pitch's Pitch Performance page and have the AI replay THAT exact scenario, so the
rep gets repetition on the real thing. The founder chose (picker): replay the WHOLE pitch, scored on the rep's weak
spot from that pitch.

## Understanding (reuse the existing engine — §0/§1.5)
A subagent mapped the codebase. There is already an LLM roleplay engine (`/api/coach/sales-session/roleplay`: the
model plays the PROSPECT, turn-based, with an optional focus-anchored SCORED review) and a client
(`/dashboard/sales-coach/roleplay`) that already SEEDS from a URL param (`?focus=`) on mount and generates a
scenario (persona + situation) via `practice-scenario`. So the whole feature is a new SEED source, not a new
simulator. One real constraint: the recorded pitch transcript is a single NON-diarized blob (rep+customer mixed),
so the customer's objections must be reconstructed by an LLM pass (the same inference the pitch analyzer relies on).

## The build (§1.5 organic — mirror the focus-seed path)
- `practiceScenario.ts` — `buildPitchReplaySystemPrompt` + `buildPitchReplayUserMessage`: reconstruct the CUSTOMER
  (persona + the objections THEY actually raised) from the transcript, into the SAME `PracticeScenario` JSON the
  client already seeds from. Reuses `parsePracticeScenario` (the §3.4 honesty seam).
- new route `practice-scenario/from-pitch` — `POST {pitchId}`: RLS-reads the pitch (non-null row = owner/manager
  access, same gate as the report-card detail; a pitch you can't see is a 404, never a leak), reads its transcript
  + top improvement, reconstructs the scenario via `dissectCoachV5` (+ the CONVERSATION_IS_DATA injection fence),
  and returns `{scenario, focus}` where `focus` = the pitch's weak spot → the roleplay review is SCORED on it.
- `roleplay/page.tsx` — a `?pitchId=` mount effect (mirrors `?focus=`) calls `loadFromPitch`, seeds persona +
  situation + the weak-spot focus, and LATCHES `scenarioAttemptedRef` so the generic auto-scenario doesn't overwrite
  the pitch reconstruction. Skips if an in-progress practice is recovered (don't clobber it).
- `PitchDetail.tsx` — a "Role play" CTA on a completed pitch WITH a transcript → `/roleplay?pitchId=<id>`.

## Four-layer trace (§1.5.1)
- L1 structure: mirrors practice-scenario + the focus seed; reuses the engine. L2 effectivity: button → seed →
  practice → scored review, end-to-end (the reconstruction QUALITY is LLM, founder visual-verify). L3 continuity:
  the rep lands on the roleplay setup with the customer pre-seeded, starts, practices, gets a scored review, can
  "practice again" — a flowing loop, no dead end. L4 UI: a clear CTA next to the transcript it rebuilds from.

## Honesty (§3.4) + privacy
Faithful, not invented (the prompt forbids new objections); a missing transcript / malformed generation → null
scenario (honest fallback to a plain roleplay), never a fabricated one; roleplay stays ephemeral (not persisted,
doesn't pollute metrics — the engine's existing contract). RLS gates the pitch read (no cross-rep transcript leak).

## Session-read manifest (A22 — read_at ≥ started_at 11:30:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T11:31:00+08:00",
    "why_it_governs": "Understand the existing roleplay engine before building — reuse, don't reinvent the simulator.",
    "how_this_build_will_embody_it": "Mapped the engine + seed pattern via a subagent; the feature is a new seed source only." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T11:31:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-28T11:31:10+08:00",
    "why_it_governs": "Organic + Holistic — reuse the engine + client seed + parse seam; trace the RLS + injection ripple.",
    "how_this_build_will_embody_it": "New route mirrors practice-scenario; client mirrors ?focus=; RLS + fence reused." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-28T11:31:15+08:00",
    "why_it_governs": "Four layers — a user feature must leave the rep in a flowing state, not a dead end.",
    "how_this_build_will_embody_it": "Traced button → seed → practice → scored review → practice again; no stall." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-28T11:31:18+08:00",
    "why_it_governs": "THINK-first — surface the non-diarized-transcript constraint before building.",
    "how_this_build_will_embody_it": "Found the blob constraint via the map; the prompt tells the model to infer speakers." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-354", "read_at": "2026-08-28T11:31:20+08:00",
    "why_it_governs": "Guide-don't-overtake — the replay scope (whole pitch vs objection drill) was the founder's pick.",
    "how_this_build_will_embody_it": "Surfaced the scope as a picker; built the whole-pitch-scored option chosen." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-28T11:31:25+08:00",
    "why_it_governs": "Honesty — a faithful replay (no invented objections) and an honest fallback, never a fabricated scenario.",
    "how_this_build_will_embody_it": "Prompt forbids invention; null scenario on missing transcript / bad parse → plain roleplay." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "388-392", "read_at": "2026-08-28T11:31:28+08:00",
    "why_it_governs": "Make learning visible — repetition on the real pitch, scored on the weak spot, shows the rep improving.",
    "how_this_build_will_embody_it": "The scored review anchors on the pitch's own weak spot, so re-practice is measurable." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T11:31:30+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood the engine, surfaced the scope, reused the seams, gated honesty + RLS." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T11:31:35+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T11:31:40+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T11:31:45+08:00",
    "why_it_governs": "Gate the lesson — the honesty seam (faithful + fallback) is testable and must be tested.",
    "how_this_build_will_embody_it": "Tests assert the prompt's faithfulness/no-coaching/infer-speaker rules + transcript clamp; parse-null reused." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T11:31:50+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + exit code." }
]
```
