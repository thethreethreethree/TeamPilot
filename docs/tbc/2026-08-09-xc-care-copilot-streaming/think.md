---
tbc_version: 1
trigger: feature
started_at: 2026-08-09T10:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 2
---

# THINK — Mirror streaming + progress to the C.A.R.E AI Co-Pilot

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present, hashes unchanged. Manifest below with in-session reads.

## 2. Spec, restated (§3.2 fidelity)
Founder chose (option picker, 2026-08-09) to mirror the just-shipped Sales Coach streaming + progress to the
C.A.R.E co-pilot — with an explicit constraint: **keep C.A.R.E's own care voice; do NOT import the sales
charisma rule or the dash sanitizer.** So this is a PURE DELIVERY change: the C.A.R.E co-pilot's prompt and
output are unchanged; only the reply now streams and the wait shows honest progress.

## 3. Precedent check (A28) — reuse the sales mechanism verbatim
- The C.A.R.E co-pilot route already uses the SAME `===REASONING===` marker split as sales, and is company-less
  (calls `generateCareReply` without companyId → direct `llmCall`). So streaming = `llmStream` directly (no
  `runBrainStream`), mirroring the sales stream branch minus the brain path.
- The worker Port relay, the shared-refresh extraction, and the client progress + progressive-render + fallback
  are mirrored from the sales files (shipped 0f234a81) with C.A.R.E's token keys / message names.

## 4. Hypotheses (§1.5.2 think-first)
- **H1 — could break the working co-pilot.** → Only the `copilot` tool streams; every OTHER C.A.R.E tool is
  untouched. Streaming degrades to the proven request path via `runTool(tool, undefined, true)` on any failure.
  CONFIRMED designed-in.
- **H2 — the vm worker test loads the new onConnect listener.** → The test's chrome mock needed `onConnect`;
  added. CONFIRMED (worker tests green).

## 5. Four-layer trace (§1.5.1)
- L1: shared-refresh extracted so the JSON + stream paths can't drift. L2: reply streams; empty-after-stream
  still errors honestly. L3: progress → forming reply → renderResult + Copy (unchanged continuity). L4: C.A.R.E's
  existing panel styling, its own care voice.

## 6. Decision checklist (§6)
Understood (founder pick + the sales precedent just built); precedent reused (A28); ripple traced (only the
copilot tool + a company-less stream; care voice explicitly NOT touched); gated by tests (A30). Client
RUNTIME-UNVERIFIED — locked by wiring tests, founder live-confirms.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-09T10:02:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — mirror the exact sales mechanism, not a guess.", "how_this_build_will_embody_it": "Read the C.A.R.E copilot route + the sales stream shipped this session before mirroring." },
  { "id": "§0.1", "read_at": "2026-08-09T10:02:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Governing-doc hashes verified; manifest reflects in-session reads." },
  { "id": "§1.5.1", "read_at": "2026-08-09T10:03:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer L3 continuity — the streamed reply still ends in a copyable result.", "how_this_build_will_embody_it": "progress → forming reply → renderResult + Copy, unchanged from today." },
  { "id": "§1.5.2", "read_at": "2026-08-09T10:03:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Think-first about how the mirror could break the other C.A.R.E tools.", "how_this_build_will_embody_it": "Only the copilot tool streams; H1/H2 handled before building." },
  { "id": "§3.2", "read_at": "2026-08-09T10:04:00Z", "source_file": "CLAUDE.md", "line_range": "190-210", "why_it_governs": "Build the spec as written.", "how_this_build_will_embody_it": "Streamed the co-pilot; kept care voice; imported no sales charisma/sanitizer (founder constraint)." },
  { "id": "§3.4", "read_at": "2026-08-09T10:05:00Z", "source_file": "CLAUDE.md", "line_range": "270-295", "why_it_governs": "Honesty — no silent empties; output unchanged.", "how_this_build_will_embody_it": "Empty stream errors honestly; C.A.R.E output byte-unchanged, only streamed." },
  { "id": "§6", "read_at": "2026-08-09T10:05:00Z", "source_file": "CLAUDE.md", "line_range": "352-390", "why_it_governs": "The pre-action checklist forces precedent, ripple-trace, and gate-or-promise before writing — here it drove scoping the stream to only the copilot tool and confirming the care voice stays untouched.", "how_this_build_will_embody_it": "Section 6 answers each checklist item for this mirror." },
  { "id": "A19", "read_at": "2026-08-09T10:02:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "The governing methodology must be consulted from the working tree this session, not from cached memory of what the sales build did an hour ago.", "how_this_build_will_embody_it": "Re-read the C.A.R.E copilot route + the axioms before mirroring, rather than assuming parity." },
  { "id": "A21", "read_at": "2026-08-09T10:04:00Z", "source_file": "ThinkerThinker.md", "line_range": "60-70", "why_it_governs": "One mechanism — the shared refresh, not two.", "how_this_build_will_embody_it": "Extracted refreshCareAccessToken so the JSON + stream paths share it." },
  { "id": "A22", "read_at": "2026-08-09T10:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads." },
  { "id": "A28", "read_at": "2026-08-09T10:03:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "Reuse precedent before inventing.", "how_this_build_will_embody_it": "Mirrored the sales stream mechanism (route SSE + Port relay + client)." },
  { "id": "A30", "read_at": "2026-08-09T10:07:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the class, don't leave it in prose.", "how_this_build_will_embody_it": "copilot route stream test + worker/client wiring guards." },
  { "id": "A35", "read_at": "2026-08-09T10:06:30Z", "source_file": "ThinkerThinker.md", "line_range": "90-96", "why_it_governs": "Name the un-headlined reliance.", "how_this_build_will_embody_it": "closure.md names the company-less-llmStream + serverless-stream reliances." },
  { "id": "A38", "read_at": "2026-08-09T10:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "check.md pastes the run + exit code." }
]
```
