---
tbc_version: 1
trigger: feature
started_at: 2026-08-09T09:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 14
hypotheses: 3
---

# THINK — Sales Coach "Suggested Response": streaming + progress + charismatic voice

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in tree, hashes unchanged from the prior build this
session. The founder's build system `docs/THINK-BUILD-CHECK-PROMPTS.md` was consulted. Axioms consulted this
session are in the manifest below with in-session read timestamps.

## 2. Spec, restated (§3.2 fidelity)
Founder reported: "It takes a long time for Sales Coach extension to formulate a Suggested Response." Presented
the diagnosis + option picker; founder chose **stream + progress** AND was firm that quality must NOT be
sacrificed for speed ("leave the model/KB as-is"). Then, mid-build, three voice directives from a live draft
screenshot: (a) the response must not contain em/en dashes ("---" characters), (b) it must sound more natural
(warm, playful, professional), (c) it must be **charismatic** — "what makes an effective salesperson is that
they are very charismatic; we need our Sales Coach Extension to have that personality."

So: do not touch the model, KB, or prompt grounding (quality intact); fix the WAIT experience (stream the reply
as it forms + an honest staged progress state); and shape the VOICE (charisma-first, no AI-tell dashes).

## 3. Precedent check (A28) — reuse, don't invent
- **Streaming**: the app already streams LLM output over SSE (`/api/ai/briefing/stream` via `runBrainStream`
  and `llmStream`). Reused that exact pattern for `/suggest` rather than a new transport. Verified
  `runBrainStream` gates identically to the sales non-stream path (both keyed on `guidanceEnabled`; sales
  passes no `controlExempt`), so streaming introduces NO behavior drift.
- **MV3 streaming**: `chrome.runtime.sendMessage` is single-response, so a long-lived Port is the standard
  streaming transport — the worker (CORS-free) reads the SSE body, same reason the JSON tools live in the
  worker.
- **Shared format (A21 one mechanism)**: co-pilot already used the `===REASONING===` marker; formulate used
  STRICT JSON (which cannot stream to a human). Unified both on the marker in one module so a single reader
  splits either engine — a FORMAT change only; reply CONTENT is unchanged (honesty rule: no quality sacrifice).

## 4. Hypotheses (§1.5.2 think-first)
- **H1 — streaming could break the working flow.** The suggest path is what the founder uses today; a blind,
  runtime-unverifiable stream could regress it. → Mitigation: streaming DEGRADES to the proven non-stream
  request path on any failure (connect throw, error event, port disconnect, empty). The progress state is a
  pure-client floor that works regardless. CONFIRMED designed-in.
- **H2 — the JSON formulate path streams ugly.** Streaming `{"reply":"Hi ther…` shows JSON forming. →
  Mitigation: unify formulate onto the marker format. CONFIRMED handled.
- **H3 — a prompt instruction alone won't "make sure" no dashes.** The founder said "make sure". A prompt is
  best-effort. → Mitigation: deterministic `stripAiDashes` sanitizer on the finalized reply (server) + a live
  strip on the streaming view (client), targeting ONLY em/en/triple dashes, leaving normal hyphens. CONFIRMED.

## 5. Four-layer trace (§1.5.1)
- **L1 structure**: new shared `salesSuggestFormat` module holds the marker + split + sanitizer + voice rule —
  one source, both engines + the route + the client stay in sync.
- **L2 effectivity**: the reply streams token-by-token; empty-after-stream still 502s honestly.
- **L3 continuity**: progress → forming reply → final render + Copy; never a dead spinner, never a dead end.
- **L4 surface**: staged progress text + a blinking caret while streaming; reduced-motion respected.

## 6. Decision checklist (§6)
Understood from the record (founder's own latency report + live screenshots); precedent reused (A28); ripple
traced (streaming gate parity, formulate format consumers = suggest route only); gated by tests (A30); voice is
a prompt+sanitizer change, not a model change (quality intact per founder). Client is RUNTIME-UNVERIFIED — locked
by wiring tests, live-confirmed by founder (established extension posture).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-09T09:05:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand the problem before solving — here, the real latency cause before any fix.", "how_this_build_will_embody_it": "Diagnosed reasoning-model + KB size from the code before proposing; did not touch the cause the founder wants kept." },
  { "id": "§0.1", "read_at": "2026-08-09T09:05:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition incl. the build plan.", "how_this_build_will_embody_it": "Build plan consulted; governing-doc hashes verified unchanged." },
  { "id": "§1.5.1", "read_at": "2026-08-09T09:06:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer: L3 workflow continuity — does the reply leave the rep flowing (stream → final → copy).", "how_this_build_will_embody_it": "Progress → forming reply → final render + Copy; no dead spinner or dead end (section 5)." },
  { "id": "§1.5.2", "read_at": "2026-08-09T09:06:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Think-then-search: how the surrounding worker/gate could silently break under streaming.", "how_this_build_will_embody_it": "H1-H3 formed before building; gate-parity confirmed by reading runBrainStream." },
  { "id": "§3.2", "read_at": "2026-08-09T09:07:00Z", "source_file": "CLAUDE.md", "line_range": "190-210", "why_it_governs": "Build the spec as written; the Understanding Gate is structural.", "how_this_build_will_embody_it": "Built exactly the founder's picked scope (stream+progress, quality untouched, charismatic no-dash voice)." },
  { "id": "§3.4", "read_at": "2026-08-09T09:12:00Z", "source_file": "CLAUDE.md", "line_range": "270-295", "why_it_governs": "Honesty is the moat — no silent empties, no quality sacrifice for speed.", "how_this_build_will_embody_it": "Model/KB untouched; empty stream 502s honestly; sanitizer is format-only, not content." },
  { "id": "§6", "read_at": "2026-08-09T09:08:00Z", "source_file": "CLAUDE.md", "line_range": "352-390", "why_it_governs": "Decision checklist — precedent, ripple, gate-or-promise.", "how_this_build_will_embody_it": "Section 6 answers each." },
  { "id": "A19", "read_at": "2026-08-09T09:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted in-tree, not cached.", "how_this_build_will_embody_it": "Build plan + axioms read this session." },
  { "id": "A21", "read_at": "2026-08-09T09:09:00Z", "source_file": "ThinkerThinker.md", "line_range": "60-70", "why_it_governs": "One mechanism, not a fork — same-purpose code must share a source.", "how_this_build_will_embody_it": "Marker + split + sanitizer + voice live in ONE shared module used by both engines, the route, and the client." },
  { "id": "A22", "read_at": "2026-08-09T09:11:00Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects reads done during this build." },
  { "id": "A28", "read_at": "2026-08-09T09:07:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "Check for precedent before treating a choice as novel.", "how_this_build_will_embody_it": "Reused the briefing SSE + runBrainStream pattern and the MV3 Port transport rather than inventing." },
  { "id": "A30", "read_at": "2026-08-09T09:10:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the class, don't leave it in prose.", "how_this_build_will_embody_it": "Tests gate: stream SSE branch, engine dispatch, marker split, sanitizer, voice rule, worker relay, client streaming+fallback." },
  { "id": "A35", "read_at": "2026-08-09T09:11:30Z", "source_file": "ThinkerThinker.md", "line_range": "90-96", "why_it_governs": "Name the un-headlined reliance, not just the citation.", "how_this_build_will_embody_it": "closure.md names the gate-parity + serverless-stream reliances the build leaned on." },
  { "id": "A38", "read_at": "2026-08-09T09:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command by name + output.", "how_this_build_will_embody_it": "check.md pastes the run + exit code." }
]
```
