---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T04:32:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 15
hypotheses: 2
---

# THINK — Sales Coach Extension, Phase 1c: summarize ("catch me up")

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

## 2. Where this sits (§0)
Third tool of the standalone Sales Coach extension. A rep re-opening a prospect thread wants a fast, honest
read of where the deal stands before replying — the sales analogue of the C.A.R.E extension summarize.
Text-in, like the rest.

## 3. What this build is + the ONE deliberate difference
- `generateSalesSummary({conversation, repName})` — text-in, prose-out, reusing the generic `generateCareReply`
  and the `CONVERSATION_IS_DATA` fence, sales-framed (deal state / objection / next step).
- `POST /api/coach/extension/summarize` — shared `guardExtensionRequest`. EPHEMERAL.
- **The distinct contract (§3.4):** unlike dissect/coach (which swallow to honest-EMPTY), the summary engine
  does NOT catch — it lets an `LlmError` propagate so the route maps rate-limit → 429 and other failures →
  502. An empty summary would dishonestly read as "nothing to summarize" — a failure must surface as an
  ERROR, not as false silence. This mirrors the C.A.R.E summarize route's error mapping.

## 4. Interconnection trace (§1.5)
- Reuses `guardExtensionRequest`/entitlement unchanged (auth parity via the invariant audit).
- Reuses `generateCareReply` (generic text-out LLM) — no new provider path.
- EPHEMERAL — no store, no §3.1 event.

## 5. §3.4 honesty — surface the error, don't fake silence
Grounds every point in the thread; forbids inventing a commitment/price/agreement; on a thin thread says so
in one line rather than inventing a deal state; on a provider failure returns an ERROR (429/502), never a
blank summary that reads as "nothing here".

## 6. Hypotheses (§1.5.2)
- **H1 (false-empty on failure):** a naive summarize could swallow an LLM error into "" and render as
  "nothing to summarize". Confirm: does the route map LlmError → 429/502 instead of returning empty? Route
  test asserts rate_limit→429, server→502, non-LLM→502, and no summary field on error. **Held.**
- **H2 (auth parity):** confirm 402/429 short-circuit before the engine. Route test asserts it. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T04:32:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — the text-in reality + the honest-error contract that separates summarize from dissect.", "how_this_build_will_embody_it": "Section 3 states why summarize surfaces errors instead of degrading to empty." },
  { "id": "§0.1", "read_at": "2026-08-08T04:32:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T04:32:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — reusing the guard/LLM must not break their consumers.", "how_this_build_will_embody_it": "Section 4 traces each reused seam; no new auth/provider/schema surface." },
  { "id": "§1.5.1", "read_at": "2026-08-08T04:32:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 structure (reuse) + L2 effect (works invoked as the extension will).", "how_this_build_will_embody_it": "build.md walks the layers; L4 surface deferred to the client phase, flagged." },
  { "id": "§1.5.2", "read_at": "2026-08-08T04:32:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesize false-empty + auth parity before building.", "how_this_build_will_embody_it": "Section 6 states H1/H2 with confirming tests." },
  { "id": "§3.1", "read_at": "2026-08-08T04:32:00Z", "source_file": "CLAUDE.md", "line_range": "257-270", "why_it_governs": "Append-only — a new surface must not create an unmanaged write.", "how_this_build_will_embody_it": "EPHEMERAL: conversation processed, never stored — no event, no table." },
  { "id": "§3.3", "read_at": "2026-08-08T04:32:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — flag deferred work (co-pilot, client) rather than silently omit or over-build it.", "how_this_build_will_embody_it": "closure.md's Flagged-not-fixed records the deferred tools as sequenced Phase 2, not skipped." },
  { "id": "§3.4", "read_at": "2026-08-08T04:32:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — a failure must not render as false 'nothing to summarize'.", "how_this_build_will_embody_it": "The engine lets LlmError propagate; the route maps it to 429/502 and never returns an empty summary." },
  { "id": "§5", "read_at": "2026-08-08T04:32:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — one verifiable, tested tool per unit.", "how_this_build_will_embody_it": "Phase 1c is one complete gated unit; client deferred, not faked." },
  { "id": "§6", "read_at": "2026-08-08T04:32:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks understood-why, ripple trace, honesty rationale." },
  { "id": "A19", "read_at": "2026-08-08T04:32:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A22", "read_at": "2026-08-08T04:32:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T04:32:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate.", "how_this_build_will_embody_it": "The error-mapping (never false-empty) is locked by route tests for rate_limit/server/non-LLM." },
  { "id": "A31", "read_at": "2026-08-08T04:32:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-920", "why_it_governs": "Schema-complete is not built — the client caller is not built yet.", "how_this_build_will_embody_it": "check.md labels this SUBSTRATE; the human-facing seam is Phase 2." },
  { "id": "A38", "read_at": "2026-08-08T04:32:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit 0." }
]
```
