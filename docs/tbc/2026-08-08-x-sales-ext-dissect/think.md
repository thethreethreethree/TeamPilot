---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T04:20:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 15
hypotheses: 2
---

# THINK — Sales Coach Extension, Phase 1a: text-in sales dissect

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json (hash + line count).
Re-verified this session by `sha256sum`. Cited clauses re-read this session (manifest in section 7).

## 2. Where this sits (§0 understand-before-solving)
Founder priority: a SEPARATE standalone Sales Coach browser extension (their architecture decision, §3.3),
working across the top communication platforms, like C.A.R.E but for sales. Preflight established the
precedent (`extension/` — 11 platform adapters, data-driven tools, shared server guard) and the pivotal
technical fact: the v5 sales engines (`generateSalesDissect`) consume speaker-labeled `TranscriptSegment[]`
from a DB session; the extension only ever has the RAW TEXT of the conversation the rep is viewing. The
C.A.R.E extension already solved this with text-in engines (`generateConversationDissect`). Phase 1a builds
the first text-in SALES engine on that proven pattern — the verifiable server substrate the client will call.

## 3. What this build is (spec fidelity)
- `generateSalesTextDissect({sourceText, repName})` — text-in, sales-framed (what's working / the
  opportunity / the next move + a §3.3 guiding question), reusing `dissectCoachV5`, the source cap, and the
  `CONVERSATION_IS_DATA` injection fence.
- `POST /api/coach/extension/dissect` — wraps it via the shared, product-neutral `guardExtensionRequest`
  (IP guard → entitlement → per-user rate limit → zod), the SAME posture as the C.A.R.E extension routes.
- Tests: the pure grounding parse + the route gate ordering.

## 4. Interconnection trace (§1.5)
- Reuses `guardExtensionRequest`/`requireEntitledExtensionUser` unchanged — no new auth surface; the
  invariant audit's "every extension route authenticated" holds because the route goes through the guard.
- Reuses `dissectCoachV5` (the shared coach LLM with the reasoning-headroom fix) — no new provider path.
- EPHEMERAL: the scanned text is processed, never stored — no schema, no new table, no §3.1 event.

## 5. §3.4 honesty — grounded, never fabricated
Every claimed strength must quote a REAL line from the pasted text (whole, whitespace-normalized) or it is
dropped; a thin thread returns hasSignal:false. "Always read" is not "fabricate" — a short-but-real exchange
gets a short REAL read; genuine non-signal returns empty. Mirrors the C.A.R.E engine's grounding discipline.

## 6. Hypotheses (§1.5.2)
- **H1 (fabrication risk):** the LLM could invent a flattering quote. Confirm: does the parse drop an excerpt
  absent from the source? Test with a hallucinated excerpt → dropped. **Held.**
- **H2 (auth parity):** a coach extension route could accidentally skip the entitlement gate. Confirm: does it
  reuse `guardExtensionRequest` so unentitled/rate-limited requests are turned away before the engine? Route
  test asserts 402/429 short-circuit before the engine. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T04:20:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — establish the text-in-vs-segment reality before building the engine.", "how_this_build_will_embody_it": "Section 2 records the preflight finding that segment engines don't fit the extension." },
  { "id": "§0.1", "read_at": "2026-08-08T04:20:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T04:20:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — reusing the shared guard/LLM/fence must not break their existing consumers.", "how_this_build_will_embody_it": "Section 4 traces each reused seam and confirms no new auth/provider/schema surface." },
  { "id": "§3.1", "read_at": "2026-08-08T04:20:00Z", "source_file": "CLAUDE.md", "line_range": "257-270", "why_it_governs": "Events are append-only — a new surface must not create an unmanaged write.", "how_this_build_will_embody_it": "The route is EPHEMERAL: scanned text is processed, never stored — no event, no table, no write." },
  { "id": "§1.5.1", "read_at": "2026-08-08T04:20:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 structure (reuse) and L2 effect (the route works invoked as the extension will).", "how_this_build_will_embody_it": "build.md walks the layers; L4 surface is deferred to the client phase and flagged as such." },
  { "id": "§1.5.2", "read_at": "2026-08-08T04:20:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesize fabrication + auth-parity before building.", "how_this_build_will_embody_it": "Section 6 states H1/H2 with confirming tests." },
  { "id": "§3.3", "read_at": "2026-08-08T04:20:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — the read invites the rep's own view, not a verdict.", "how_this_build_will_embody_it": "The output carries a guidingQuestion and the prompt frames opportunity/next-move as reasoning, not orders." },
  { "id": "§3.4", "read_at": "2026-08-08T04:20:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — grounded, never fabricated; honest-empty on thin input.", "how_this_build_will_embody_it": "The parse drops ungrounded excerpts; the engine returns EMPTY on sparse/failed input and logs the cause." },
  { "id": "§5", "read_at": "2026-08-08T04:20:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — build the verifiable slice well, don't rush the whole extension.", "how_this_build_will_embody_it": "Phase 1a is one complete, tested, gated unit; the browser client (unverifiable in sandbox) is deferred, not faked." },
  { "id": "§6", "read_at": "2026-08-08T04:20:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks understood-why, the record, the ripple trace, and the honesty rationale." },
  { "id": "A19", "read_at": "2026-08-08T04:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A22", "read_at": "2026-08-08T04:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T04:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate.", "how_this_build_will_embody_it": "The grounding contract is locked by a test that fails if a hallucinated excerpt is kept." },
  { "id": "A31", "read_at": "2026-08-08T04:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-920", "why_it_governs": "Schema-complete is not built — assert the seam. Here the read-path (client) is not built yet.", "how_this_build_will_embody_it": "check.md is explicit: the server write/read seam is asserted; the human-facing client caller is Phase 2, so this is substrate, not a shippable end-feature yet." },
  { "id": "A38", "read_at": "2026-08-08T04:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit 0." }
]
```
