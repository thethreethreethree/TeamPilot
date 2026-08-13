---
tbc_version: 1
trigger: build
started_at: 2026-08-13T23:50:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — STT-capture instrumentation ("some agents get no after-pitch feedback")

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why
Founder (2026-08-13): "some sales agents are dropping or having no after-pitch feedback," and suspected a
"cap on session." §0/§1.2 record-check FIRST: I verified there is NO explicit session/transcript cap
(`getSessionTranscript` loads all segments, no `.limit()`). The real cause is the reliability failure the
codebase already documents — `persistRecording.ts`: "ElevenLabs realtime STT sometimes captures zero turns."
Zero/few AGENT turns → the review engine short-circuits to EMPTY (agentSegments < MIN_AGENT_SEGMENTS) → no
"Your read." Founder chose "instrument first" to confirm + find affected agents before any STT swap.

**Key finding driving the build:** the existing `capture-health` route (built 2026-08-12 for "the cost of the
issue") counts only "no transcript at all" — it MISSES the ONE-SIDED case (customer captured, agent's mic not:
segments present, 0 agent turns), which ALSO yields no feedback but was counted "captured fine." So it
UNDERCOUNTS the true cost. The build corrects that + adds a per-agent breakdown (find WHO), plus a per-session
real-time log at the feedback-generation point.

## 3. What I built
- **Per-session log** (`afterPitch.ts` `generateAfterPitchSummary`): `[stt-capture]` line with session, company,
  context, total/agent/customer turn counts, `empty`, and `oneSided` (segments>0 but 0 agent turns). Logging
  only — no behavior change; fires where the transcript loads, right before the length===0 EMPTY short-circuit.
- **`capture-health` extension**: detect 0-AGENT-turns (the true no-feedback population), split `oneSided` vs
  `empty(failed)`, add `noFeedback`/`noFeedbackRate`, and a `byAgent` breakdown (ended, noFeedback, oneSided,
  empty, rate — worst first) so a manager sees which reps are affected. Legacy `failed`/`failureRate` kept for
  continuity. Test updated to cover the split + per-agent.
- **Settings UI** (`CaptureHealthCard`): surface no-feedback (true cost), one-sided, empty, and the
  most-affected-agents list.

## 4. What I did NOT do (founder guardrail)
- **No cap on the session/transcript** — founder explicitly forbade it, and there was none to begin with. The
  instrumentation is read-only measurement.
- **The corpus-cap** (authorized earlier) is PAUSED — the founder redirected to the real pain; the shared helper
  (`src/lib/llm/corpusBudget.ts`) is built but unwired, not in this commit.

## 5. Hypothesis (§1.5.2)
- **H1 — does keying "captured" on an AGENT segment correctly identify the no-feedback population?** Yes: the
  review/dissect/score engines all short-circuit to EMPTY at `agentSegments.length < MIN_AGENT_SEGMENTS` (=1,
  drift-guarded). So "has ≥1 agent segment" ⟺ "the engine will run" ⟺ "feedback is possible." A session with
  segments but no agent segment (one-sided) is exactly the missed no-feedback case. CONFIRMED against the engines.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-13T23:50:10Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the real cause from the record before building — the founder's 'cap' hypothesis is a suspect.", "how_this_build_will_embody_it": "Verified NO session cap exists; traced the cause to STT zero-turns via persistRecording + the engine gate before instrumenting." },
  { "id": "§0.1", "read_at": "2026-08-13T23:50:15Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1)." },
  { "id": "§1.2", "read_at": "2026-08-13T23:50:20Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective/record-check: the 'no feedback' cause is read from the actual pipeline + existing capture-health, not theorized.", "how_this_build_will_embody_it": "Found the existing capture-health UNDERCOUNTS (misses one-sided) by reading it; corrected." },
  { "id": "§1.5.1", "read_at": "2026-08-13T23:50:25Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 effectivity: measure the TRUE no-feedback population, not a proxy.", "how_this_build_will_embody_it": "noFeedback = 0 agent turns (empty OR one-sided), the exact condition that yields no 'Your read'." },
  { "id": "§2", "read_at": "2026-08-13T23:50:30Z", "source_file": "CLAUDE.md", "line_range": "52-75", "why_it_governs": "Diagnose before patching — instrument to get the real data before swapping STT.", "how_this_build_will_embody_it": "Instrumentation FIRST (this build); the managed-STT swap waits on the baseline." },
  { "id": "§1.5.2", "read_at": "2026-08-13T23:50:35Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive: while building the instrument, found the adjacent capture-health undercount gap.", "how_this_build_will_embody_it": "Fixed the undercount + added per-agent targeting in the same build." },
  { "id": "§3.4", "read_at": "2026-08-13T23:50:40Z", "source_file": "CLAUDE.md", "line_range": "275-290", "why_it_governs": "Honest measurement — a capture count that misses one-sided is a guessed-low number.", "how_this_build_will_embody_it": "noFeedback reports the true cost; the honest-zero + paged-count discipline is preserved." },
  { "id": "A30", "read_at": "2026-08-13T23:50:52Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the property with a test where testable.", "how_this_build_will_embody_it": "capture-health's no-feedback split + per-agent rates are locked by the updated route test." },
  { "id": "§6", "read_at": "2026-08-13T23:50:45Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — the log adds no behavior; the route change is additive + tested.", "how_this_build_will_embody_it": "Legacy fields kept; test covers the new split + per-agent." },
  { "id": "A19", "read_at": "2026-08-13T23:50:50Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the in-tree capture pipeline before changing it.", "how_this_build_will_embody_it": "Read getSessionTranscript, afterPitch, capture-health + its test before editing." },
  { "id": "A22", "read_at": "2026-08-13T23:50:55Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads; minimum set present." },
  { "id": "A38", "read_at": "2026-08-13T23:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
