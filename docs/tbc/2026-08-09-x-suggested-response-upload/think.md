---
tbc_version: 1
trigger: feature
started_at: 2026-08-09T10:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 2
---

# THINK — Sales Coach extension: merged "Suggested Response" + conversation file upload

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in tree, hashes unchanged. The founder's build system
`docs/THINK-BUILD-CHECK-PROMPTS.md` was read this session (now a §0.1 required-read per memory) and this build
follows its Prompt 1. Cited axioms consulted this session (A28/A31/A33/A22/A30/A38 read directly; CLAUDE.md §§
carried in-context).

## 2. Spec, restated (§3.2 fidelity)
Two founder requests (both picked via option-picker, 2026-08-09):
1. **Suggested Response** — merge the three buttons Coach-my-reply / Draft-my-reply / Say-it-for-me into ONE.
   Chosen behavior: one button + one OPTIONAL guidance box — blank → draft from the conversation; filled → shape
   the rep's draft/intent into a stronger message; either way return the reply + the "move".
2. **Upload conversation** — let the rep upload a PDF/TXT they exported from a chat; the server extracts the text
   so all tools run on it (their real example: copied a chat into a doc, saved as PDF).

Built as written. No deviation flagged.

## 3. Precedent check (A28) — two "founder decisions" that were actually alignments
- The merged action does NOT need a new engine: the co-pilot and formulate ENGINES already produce
  `{reply, reasoning}`; /suggest dispatches to them by guidance-presence. Reuse, not rebuild.
- The upload does NOT need a new parser or a new upload pattern: `@/lib/documents/extractText` (unpdf/jszip) +
  the `coach/sales-session/extract` route are an exact precedent — extract-to-text-in-memory, strict extension
  allowlist, size cap, entitlement/role gate. /extract mirrors it; its invariant-audit allowlist entry mirrors
  the sibling's (INV5, same "never stored/served" reasoning).

## 4. Reachability plan (A31) — the seam both features live on
- Suggested Response write-path: panel `guidance` textarea → worker forwards `guidance` → /suggest → engine. If
  the worker didn't forward `guidance` (it only relayed draft/intent), the box would be dead config — so that
  forward is part of the build, guarded by the background-wiring test.
- Upload write-path: file → panel base64 (a File can't cross sendMessage) → worker rebuilds multipart → /extract
  → extractText → text → setSelection. read-path: the extracted text becomes `currentSelection`, which every
  tool already consumes. Both directions asserted (route tests + wiring tests).

## 5. Hypotheses (§1.5.2), before building
- H1: the worker forwards only an allowlist of keys → a new `guidance` key would be silently dropped unless
  added. CONFIRMED (background.js:108 forwards conversation/draft/intent only). → forwarded `guidance`.
- H2: guardExtensionRequest consumes the JSON body (readBody), so a multipart route can't reuse it as-is.
  CONFIRMED (it calls readBody unconditionally). → made `schema` optional via overloads so /extract reuses the
  ONE gate sequence (drift-avoidance: the guard exists because six inline copies drifted).

## 6. Gate-or-promise (A30/A33)
GATED: the merged dispatch (suggest route test — guidance→formulate, none→copilot), the optional-input exemption
(client-wiring regex), the worker's guidance-forward + multipart handler (background-wiring), extract validation
(extract route test), and reverse-drift (config-wiring: /extract non-tool, superseded routes documented).

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-09T10:32:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand the request + existing code before building.", "how_this_build_will_embody_it": "Grounded in copilot/formulate/extract precedent before writing (sections 3-4)." },
  { "id": "§0.1", "read_at": "2026-08-09T10:32:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition — incl. the build plan.", "how_this_build_will_embody_it": "Followed THINK-BUILD-CHECK-PROMPTS Prompt 1; hashes verified." },
  { "id": "§1.5.1", "read_at": "2026-08-09T10:33:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer: L2 does the merged button actually work end-to-end; L3 does upload leave the rep flowing (text becomes capture, tools run).", "how_this_build_will_embody_it": "Upload feeds currentSelection so the next action (run a tool) is immediate; suggested absorbs all three capabilities." },
  { "id": "§1.5.2", "read_at": "2026-08-09T10:33:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Think-then-search about how the surrounding worker/guard could silently drop the new inputs.", "how_this_build_will_embody_it": "H1/H2 formed before grepping; both confirmed and handled." },
  { "id": "§3.2", "read_at": "2026-08-09T10:34:00Z", "source_file": "CLAUDE.md", "line_range": "213-231", "why_it_governs": "Build the spec as written; the Understanding Gate is structural.", "how_this_build_will_embody_it": "Built the founder's two picked behaviors exactly; no scope drift." },
  { "id": "§6", "read_at": "2026-08-09T10:34:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist — precedent, ripple, gate-or-promise.", "how_this_build_will_embody_it": "Sections 3-6 answer each." },
  { "id": "A19", "read_at": "2026-08-09T10:32:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted in-tree, not cached.", "how_this_build_will_embody_it": "Build plan + axioms read this session." },
  { "id": "A22", "read_at": "2026-08-09T10:41:00Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects reads done during the build." },
  { "id": "A28", "read_at": "2026-08-09T10:36:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "Check for a precedent before treating a choice as novel.", "how_this_build_will_embody_it": "Reused copilot/formulate engines + the sales-session/extract pattern + its invariant allowlist reasoning." },
  { "id": "A30", "read_at": "2026-08-09T10:37:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the class, don't leave it in prose.", "how_this_build_will_embody_it": "5 test files gate the merged dispatch, optional-input, worker forwarding, extract validation, reverse-drift." },
  { "id": "A31", "read_at": "2026-08-09T10:38:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-820", "why_it_governs": "Schema-complete ≠ built; assert both seam directions.", "how_this_build_will_embody_it": "Section 4 traces write-path AND read-path for both features; build.md records them per-feature." },
  { "id": "A38", "read_at": "2026-08-09T10:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command by name + output.", "how_this_build_will_embody_it": "check.md pastes `npm run check` exit 0." }
]
```
