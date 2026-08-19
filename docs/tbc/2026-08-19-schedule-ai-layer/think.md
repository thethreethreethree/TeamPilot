---
title: Schedule Management System — Phase 4 part 2 (AI layer — DeepSeek parse + propose)
build_plan: ScheduleManagementSystem.md
phase: 4 of 8 (LLM half)
started_at: 2026-08-19T00:00:00Z
manifest_entries: 12
---

# Phase 4 (part 2) — AI layer (DeepSeek parse + propose)

## Step 2 — Session-read manifest (A22 / A35)
```json
[
  { "id": "§0",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "10-21",  "why_it_governs": "Knowledge != intelligence — a fluent LLM parse that is confidently wrong is the trap; understanding must be earned, so the parse is confirmed by a human before it becomes an event.", "how_this_build_will_embody_it": "parse-then-confirm: parseRequest returns a DRAFT the human confirms; a malformed parse fails loud (unclear), never a guessed write." },
  { "id": "§0.1",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",  "why_it_governs": "The governing methodology must be in-tree and read this session.", "how_this_build_will_embody_it": "Docs hash-matched; assets opened this session." },
  { "id": "§1.5.1", "read_at": "2026-08-19T00:51:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer sieve — an LLM surface cannot rescue a broken deterministic layer beneath it.", "how_this_build_will_embody_it": "The LLM only phrases the deterministic layers (verdict + candidates) proven in Phases 2-3; it adds no logic of its own." },
  { "id": "§1.5.2", "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK first about failure modes then search.", "how_this_build_will_embody_it": "Hypotheses on injection, malformed-parse, and dash-leak before the code." },
  { "id": "§3.3",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "320-331", "why_it_governs": "Guide, don't overtake — the AI proposes with the WHY; the human decides. The proposal VOICE is a founder-owned behavior.", "how_this_build_will_embody_it": "Founder picker chosen: recommend + why, warm + plain, parse-then-confirm. The proposal never claims a change is required; the manager always decides." },
  { "id": "§3.4",   "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "332-343", "why_it_governs": "Honesty — no fabrication; a failed parse must not be dressed as a valid request.", "how_this_build_will_embody_it": "A malformed/non-conforming parse returns unclear (fail loud); the proposal is told never to fabricate people or claim required/blocked." },
  { "id": "§5",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "360-401", "why_it_governs": "Deterministic vs LLM — the LLM interprets/proposes, never computes the gate or overrides the verdict.", "how_this_build_will_embody_it": "ai.ts calls no predicate + no authority; it phrases the deterministic impact + candidates. The parse is schema-validated before any write." },
  { "id": "§6",     "read_at": "2026-08-19T00:12:00Z", "source_file": "CLAUDE.md", "line_range": "402-440", "why_it_governs": "Checklist — guide-not-overtake + measure-consequence.", "how_this_build_will_embody_it": "The AI guides; the human decides; the parse is validated." },
  { "id": "A19",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "454-475", "why_it_governs": "Methodology in-tree + read.", "how_this_build_will_embody_it": "Assets opened this session." },
  { "id": "A22",    "read_at": "2026-08-19T00:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "593-631", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "This manifest." },
  { "id": "A30",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "769-789", "why_it_governs": "Gate the lesson — a test that fails on regression.", "how_this_build_will_embody_it": "8 tests lock fail-loud parse, schema-validated build, fence-in-prompt, dash-strip." },
  { "id": "A38",    "read_at": "2026-08-19T00:51:00Z", "source_file": "ThinkerThinker.md", "line_range": "1000-1021", "why_it_governs": "Verified = the canonical command by name.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit code." }
]
```
Also embodied (read this session): the prompt-injection posture — untrusted request text is fenced with the
shared CONVERSATION_IS_DATA constant (reused, not re-invented); A40 — the LLM never overrides the verdict.

## Step 3 — Hypotheses (§1.5.2)
- **H1 prompt injection** via the request text. Mitigation: CONVERSATION_IS_DATA fence in the parse prompt (tested: the fence is present).
- **H2 malformed parse becomes an event.** Mitigation: parseLlmOutput returns unclear on bad JSON/shape; buildTimeOffEvent re-validates via eventSchema (tested: a bad type is rejected).
- **H3 dash leak** (voice rule). Mitigation: stripAiDashes on the proposal (tested: no em/en dash).
- **H4 the LLM overrides the verdict.** Mitigation: ai.ts imports no predicate/authority; it only phrases given inputs.

## Step 4 — Spec fidelity
Phase 4 steps 1 (parse) + 3 (propose), built to the founder picker (recommend+why / parse-then-confirm /
warm+plain). Reuses llmCall (chokepoint), CONVERSATION_IS_DATA (fence), stripAiDashes (voice), eventSchema
(validation). No new provider client; the LLM stays advisory.

## Step 5 — Four-layer
Advisory layer over proven deterministic logic. 1: reuses shared helpers, injectable llm (testable). 2: parse
+ propose behave on a mocked llm as a real call would. 3: consumer is the Phase-5 request-entry + review UI. 4:
none yet. **SHIPPABLE foundation.**
