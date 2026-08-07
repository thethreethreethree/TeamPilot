---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T04:38:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 16
hypotheses: 2
---

# THINK — Sales Coach Extension, Phase 1d: co-pilot ("draft my reply")

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

## 2. Where this sits (§0)
Fourth and most powerful sales tool: it generates OUTBOUND content — the rep's next message to a prospect,
plus the NAME of the sales move used. Precondition check (flagged before building): the C.A.R.E co-pilot is
NOT control-window-gated because it acts on the rep's EXTERNAL conversation, not the team's internal event
chain; only the internal-chain writer (Spawn) carries that gate. The sales co-pilot is the same shape, so it
is likewise not control-gated. EPHEMERAL — nothing stored.

## 3. What this build is
- `generateSalesCopilotReply({conversation, repName, lastSpeaker})` → {reply, reasoning}. Reuses
  `generateCareReply`, the shared `methodologyBlock`, the `CONVERSATION_IS_DATA` fence, and the SAME
  reply-vs-follow-up mode selector (`copilotModeInstruction`) the C.A.R.E co-pilot uses — one mechanism, not
  a fork (§A21). Splits the drafted reply from the one-line move-naming reasoning on a shared marker.
- `POST /api/coach/extension/copilot` — shared `guardExtensionRequest`; empty draft → 502; LlmError → 429/502.

## 4. Interconnection trace (§1.5)
- Reuses `guardExtensionRequest`/entitlement (auth parity via the invariant audit), `generateCareReply`,
  `methodologyBlock` (§A21 one methodology source), and `copilotModeInstruction` (§A21 one mode selector).
- EPHEMERAL — no store, no §3.1 event.

## 5. §3.4 honesty — draft, don't fabricate; error, don't fake-empty
The draft is built only from what the conversation supports — never an invented product capability, price,
discount, statistic, or commitment. A too-thin thread yields a "say so" reply, not an invented pitch. On a
provider failure the route returns 429/502, and an empty draft is a 502 — never a blank reply passed off as
a real one.

## 6. Hypotheses (§1.5.2)
- **H1 (reply to own words):** an agent-last thread could get a "reply" that answers the rep's own message.
  Confirm: the reused `copilotModeInstruction` switches to FOLLOW-UP on lastSpeaker="agent"; prompt test
  asserts it. **Held.**
- **H2 (blank/false draft):** the model could emit the marker first, leaving an empty reply. Confirm: the
  split yields "" and the route 502s; tested. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T04:38:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — verify the control-window posture for an OUTBOUND-content tool before building.", "how_this_build_will_embody_it": "Section 2 checks the C.A.R.E co-pilot's control decision and applies the same reasoning." },
  { "id": "§0.1", "read_at": "2026-08-08T04:38:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T04:38:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — reusing the guard/LLM/methodology/mode-selector must not break their consumers.", "how_this_build_will_embody_it": "Section 4 traces each reused seam; no new auth/provider/schema surface." },
  { "id": "§1.5.1", "read_at": "2026-08-08T04:38:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 structure (reuse) + L2 effect (works invoked as the extension will).", "how_this_build_will_embody_it": "build.md walks the layers; L4 surface deferred to the client phase, flagged." },
  { "id": "§1.5.2", "read_at": "2026-08-08T04:38:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesize reply-to-own-words + blank-draft before building.", "how_this_build_will_embody_it": "Section 6 states H1/H2 with confirming tests." },
  { "id": "§3.1", "read_at": "2026-08-08T04:38:00Z", "source_file": "CLAUDE.md", "line_range": "257-270", "why_it_governs": "Append-only — a new surface must not create an unmanaged write.", "how_this_build_will_embody_it": "EPHEMERAL: conversation processed, never stored — no event, no table." },
  { "id": "§3.3", "read_at": "2026-08-08T04:38:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — the co-pilot names the MOVE for the rep's learning, and deferred work is flagged, not silently omitted.", "how_this_build_will_embody_it": "The reasoning line teaches the move; closure.md flags the client phase as sequenced, not skipped." },
  { "id": "§3.4", "read_at": "2026-08-08T04:38:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — never fabricate a product/price/commitment; never a blank draft as a real one.", "how_this_build_will_embody_it": "The prompt forbids invented facts; the route 502s an empty draft and maps LlmError to 429/502." },
  { "id": "§5", "read_at": "2026-08-08T04:38:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — one verifiable, tested tool per unit.", "how_this_build_will_embody_it": "Phase 1d is one complete gated unit; client deferred, not faked." },
  { "id": "§6", "read_at": "2026-08-08T04:38:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks understood-why, ripple trace, honesty rationale." },
  { "id": "A19", "read_at": "2026-08-08T04:38:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A21", "read_at": "2026-08-08T04:38:00Z", "source_file": "ThinkerThinker.md", "line_range": "528-591", "why_it_governs": "One mechanism, not a fork — reuse the shared methodology block AND the shared mode selector, don't re-implement them.", "how_this_build_will_embody_it": "The engine imports methodologyBlock + copilotModeInstruction rather than inlining sales principles or re-deriving reply/follow-up logic." },
  { "id": "A22", "read_at": "2026-08-08T04:38:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T04:38:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate.", "how_this_build_will_embody_it": "The split edge-cases + the empty-draft-502 + the mode switch are locked by tests." },
  { "id": "A31", "read_at": "2026-08-08T04:38:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-920", "why_it_governs": "Schema-complete is not built — the client caller is not built yet.", "how_this_build_will_embody_it": "check.md labels this SUBSTRATE; the human-facing seam is Phase 2." },
  { "id": "A38", "read_at": "2026-08-08T04:38:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit 0." }
]
```
