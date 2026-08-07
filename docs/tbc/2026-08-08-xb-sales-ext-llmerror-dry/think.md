---
tbc_version: 1
trigger: refactor
started_at: 2026-08-08T05:44:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — DRY the LlmError→HTTP mapping across the 3 generative sales routes

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

(Build named `xb`, not `x11` — `currentBuildDir()` picks the lexicographically-last dir, and `x9`/`xa` > any
`x1*`; the post-9 convention is xa/xb/… See the reference memory from the previous build.)

## 2. The finding (simplify/reuse — my own session's diff)
The three GENERATIVE sales routes (summarize / copilot / formulate) each hand-rolled the IDENTICAL error
mapping in their catch: an `LlmError` rate-limit → 429, any other `LlmError` → its status (default 502), a
non-LLM failure → a logged generic 502. Three copies of an error TAXONOMY drift if one is updated and the
others aren't. Extract it.

## 3. The change
`llmErrorResponse(err, {logTag, fallbackMessage})` in `src/lib/coach/extension/llmErrorResponse.ts`; each of
the 3 routes' catch becomes a one-line call and drops its now-unused `LlmError` import. One mechanism (§A21);
the error taxonomy now lives in one place.

## 4. Interconnection trace (§1.5) — behavior preserved
The helper returns byte-identical responses to the inline blocks (same status logic, same body shape, same
log). The read-only tools (dissect/coach) do NOT use it — their engines never throw (honest-empty), so they
have no catch to share. The 3 route tests already assert 429/502/non-LLM mapping per route; behavior is
unchanged, so they pass without edits. `NextResponse` stays imported (used by the success/empty-branch
returns); only the direct `LlmError` reference leaves the routes.

## 5. Not a behavior change
Same-status, same-message, same-log. A new `+1` test file locks the mapping directly; the per-route tests
remain the end-to-end proof.

## 6. Hypothesis (§1.5.2)
- **H1 (mapping drift):** the extraction could change a status or body. Confirm: the helper is a line-for-line
  move; a 4-case helper test + the 3 unchanged route tests pass; tsc clean (no unused import). **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T05:44:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — confirm the 3 catch blocks are identical before extracting.", "how_this_build_will_embody_it": "Section 2 verified the verbatim mapping across the 3 generative routes." },
  { "id": "§0.1", "read_at": "2026-08-08T05:44:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T05:44:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — a refactor touching 3 routes must not change their responses.", "how_this_build_will_embody_it": "Section 4: line-for-line move; the route tests are unchanged and pass." },
  { "id": "§1.5.1", "read_at": "2026-08-08T05:44:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 structure: one error-mapping helper, three thin call sites.", "how_this_build_will_embody_it": "build.md shows the extraction; the helper is unit-tested." },
  { "id": "§1.5.2", "read_at": "2026-08-08T05:44:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — reviewing my OWN diff for reuse, not hunting elsewhere for bugs.", "how_this_build_will_embody_it": "Section 2 applies the simplify/reuse lens to this session's output." },
  { "id": "§3.3", "read_at": "2026-08-08T05:44:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — the C.A.R.E-side identical mapping is flagged as an optional follow-up, not forced now.", "how_this_build_will_embody_it": "closure.md RES-01 records the C.A.R.E adoption as optional." },
  { "id": "§5", "read_at": "2026-08-08T05:44:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — prefer a verifiable refactor (can't produce a false finding) over undirected bug-hunting.", "how_this_build_will_embody_it": "A behavior-preserving DRY extraction, tested, not a speculative hunt." },
  { "id": "§6", "read_at": "2026-08-08T05:44:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks the duplication, the behavior-preservation, the test evidence." },
  { "id": "A19", "read_at": "2026-08-08T05:44:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A21", "read_at": "2026-08-08T05:44:00Z", "source_file": "ThinkerThinker.md", "line_range": "528-591", "why_it_governs": "One mechanism, not a fork — three copies of an error taxonomy is the anti-pattern.", "how_this_build_will_embody_it": "llmErrorResponse is the single mapping the 3 routes call." },
  { "id": "A22", "read_at": "2026-08-08T05:44:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T05:44:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate. The mapping contract is now test-locked in one place.", "how_this_build_will_embody_it": "The 4-case helper test locks rate-limit→429 / other→502 / explicit-status / non-LLM→logged-502." },
  { "id": "A38", "read_at": "2026-08-08T05:44:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit 0." }
]
```
