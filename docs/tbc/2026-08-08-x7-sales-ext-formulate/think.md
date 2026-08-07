---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T05:06:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 15
hypotheses: 2
---

# THINK — Sales Coach Extension, Phase 1e: formulate ("say it for me")

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

## 2. Where this sits (§0)
Fifth sales tool, closing the gap to the C.A.R.E toolset. DISTINCT from co-pilot: co-pilot decides WHAT to
say from the conversation; formulate takes what the rep ALREADY wants to convey (their INTENT) and shapes it
into a sales-effective message. It mirrors, it does not judge the intent (the System-shapes-not-verdicts
stance). Text-in, like the rest.

## 3. What this build is
- `generateSalesFormulate({conversation, intent, repName})` → {reply, reasoning}. Grounds in the shared
  `methodologyBlock`, reuses `generateCareReply`, `coerceJsonText` (survive a ```json fence), and the
  `CONVERSATION_IS_DATA` fence. Does NOT catch (route maps LlmError). Pure `parseFormulateReply` exported.
- `POST /api/coach/extension/formulate` — shared `guardExtensionRequest` (with the sales productLabel). Empty
  reply → 502; LlmError → 429/502. EPHEMERAL.
- Added `formulate` to `SALES_TOOLS` (with an `intent` input) — the drift guard now covers 5 endpoints.

## 4. Interconnection trace (§1.5)
- Reuses the guard, the LLM, the shared methodology, the fence, and the shared JSON-coercion helper — no fork.
- The config change adds a 5th tool; the existing drift guard automatically asserts its endpoint→route (no
  new test needed for wiring — the guard iterates all endpoints).
- EPHEMERAL — no store, no §3.1 event.

## 5. §3.4 honesty — shape the intent, don't invent
It phrases the rep's OWN intent well; it never invents a product claim, price, discount, or commitment beyond
the intent + the conversation. Non-JSON output falls back to raw text (never errors the rep out), and an
empty reply is a 502 — never a blank message.

## 6. Hypotheses (§1.5.2)
- **H1 (fabrication):** shaping could drift into inventing a claim. Confirm: the prompt forbids invented
  facts; the parse degrades cleanly. Prompt test asserts the no-fabrication rule. **Held.**
- **H2 (blank/broken message):** malformed JSON could blank the reply. Confirm: coerceJsonText + raw-text
  fallback, and the route 502s an empty reply; tested. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T05:06:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — establish how formulate DIFFERS from co-pilot before building it.", "how_this_build_will_embody_it": "Section 2 draws the intent-in vs conversation-in distinction." },
  { "id": "§0.1", "read_at": "2026-08-08T05:06:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T05:06:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — reusing the guard/LLM/methodology/coercion must not break their consumers.", "how_this_build_will_embody_it": "Section 4 traces each reused seam; the config change rides the existing drift guard." },
  { "id": "§1.5.1", "read_at": "2026-08-08T05:06:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 structure (reuse) + L2 effect (works invoked as the extension will).", "how_this_build_will_embody_it": "build.md walks the layers; L4 surface deferred to the client phase." },
  { "id": "§1.5.2", "read_at": "2026-08-08T05:06:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesize fabrication + blank-message before building.", "how_this_build_will_embody_it": "Section 6 states H1/H2 with confirming tests." },
  { "id": "§3.1", "read_at": "2026-08-08T05:06:00Z", "source_file": "CLAUDE.md", "line_range": "257-270", "why_it_governs": "Append-only — a new surface must not create an unmanaged write.", "how_this_build_will_embody_it": "EPHEMERAL: conversation + intent processed, never stored — no event, no table." },
  { "id": "§3.3", "read_at": "2026-08-08T05:06:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — the deferred client panel is flagged, not silently omitted.", "how_this_build_will_embody_it": "closure.md flags Phase 2b (render 5 tools incl. the intent box) as sequenced." },
  { "id": "§3.4", "read_at": "2026-08-08T05:06:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — shape the intent, never fabricate; never a blank message.", "how_this_build_will_embody_it": "The prompt forbids invented facts; the route 502s an empty reply." },
  { "id": "§5", "read_at": "2026-08-08T05:06:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — one verifiable, tested tool per unit.", "how_this_build_will_embody_it": "Phase 1e is one complete gated unit on the locked pattern; client deferred." },
  { "id": "§6", "read_at": "2026-08-08T05:06:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks understood-why, the co-pilot distinction, the honesty rationale." },
  { "id": "A19", "read_at": "2026-08-08T05:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A22", "read_at": "2026-08-08T05:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T05:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate.", "how_this_build_will_embody_it": "The parse edge-cases + the empty-reply-502 are locked by tests, and the new tool's wiring by the drift guard." },
  { "id": "A31", "read_at": "2026-08-08T05:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-920", "why_it_governs": "Schema-complete is not built — the client caller is not built yet, and the new tool must not be a dead button.", "how_this_build_will_embody_it": "The drift guard asserts the formulate endpoint→route; the panel that renders it is Phase 2b (labeled substrate)." },
  { "id": "A38", "read_at": "2026-08-08T05:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit 0." }
]
```
