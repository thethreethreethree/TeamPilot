---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T04:25:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 16
hypotheses: 2
---

# THINK — Sales Coach Extension, Phase 1b: coach-my-reply

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json (hash + line count),
re-verified this session. Cited clauses re-read this session (manifest in section 7).

## 2. Where this sits (§0)
Second tool of the standalone Sales Coach extension (founder-decided architecture). Same text-in pattern
locked in Phase 1a: the rep, mid-conversation on an external platform, wants their DRAFT reply graded before
sending. The v5 sales engines are segment/session-bound; the extension has only raw text + the draft. This
is the sales analogue of the C.A.R.E extension's "Ask Coach", but grounded in the SALES methodology.

## 3. What this build is
- `generateSalesReplyCoaching({conversation, draft, repName})` — text-in, grounded in the shared
  `methodologyBlock` (the compiled Sales KB / team corpus / inline starter), reusing `dissectCoachV5` and the
  `CONVERSATION_IS_DATA` fence. Returns assessment + strengths + improvements(with the WHY) + a revision of
  the rep's OWN draft + a §3.3 guiding question. Honest-empty on a trivial draft; never throws.
- `POST /api/coach/extension/coach` — wraps it via the shared `guardExtensionRequest` (30/min, matching the
  in-app + C.A.R.E-extension coach). EPHEMERAL.

## 4. Interconnection trace (§1.5)
- Reuses `guardExtensionRequest`/entitlement unchanged (auth parity holds via the invariant audit).
- Reuses `methodologyBlock` (exported from salesReviewPrompt) — one methodology source, no fork (§A21).
- Reuses `dissectCoachV5` — no new provider path. EPHEMERAL — no store, no §3.1 event.

## 5. §3.4 honesty — grade, don't fabricate
The suggested revision REWRITES the rep's own draft; it must not invent a prospect fact, price, statistic, or
commitment absent from the conversation/draft. A trivial draft returns hasSignal:false. §3.3: teaches the WHY
and invites the rep's read, never hands down a verdict.

## 6. Hypotheses (§1.5.2)
- **H1 (fabrication risk):** the revision could invent a prospect commitment. Confirm: the prompt forbids
  inventing facts and the parse degrades an empty shell to EMPTY; structural-empty tested. **Held.**
- **H2 (auth parity):** confirm the route turns away unentitled/rate-limited requests before the engine —
  route test asserts 402/429 short-circuit. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T04:25:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — the text-in-vs-segment reality, established Phase 1a, still governs.", "how_this_build_will_embody_it": "Section 2 carries the same finding forward for the draft-grading tool." },
  { "id": "§0.1", "read_at": "2026-08-08T04:25:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T04:25:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — reusing the guard/LLM/methodology must not break their consumers.", "how_this_build_will_embody_it": "Section 4 traces each reused seam; no new auth/provider/schema surface." },
  { "id": "§1.5.1", "read_at": "2026-08-08T04:25:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 structure (reuse) + L2 effect (works invoked as the extension will).", "how_this_build_will_embody_it": "build.md walks the layers; L4 surface deferred to the client phase, flagged." },
  { "id": "§1.5.2", "read_at": "2026-08-08T04:25:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesize fabrication + auth parity before building.", "how_this_build_will_embody_it": "Section 6 states H1/H2 with confirming tests." },
  { "id": "§3.1", "read_at": "2026-08-08T04:25:00Z", "source_file": "CLAUDE.md", "line_range": "257-270", "why_it_governs": "Append-only — a new surface must not create an unmanaged write.", "how_this_build_will_embody_it": "EPHEMERAL: conversation + draft processed, never stored — no event, no table." },
  { "id": "§3.3", "read_at": "2026-08-08T04:25:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — teach the WHY, invite the rep's read.", "how_this_build_will_embody_it": "Improvements carry a WHY; the output has a guidingQuestion; the revision is an option, not an order." },
  { "id": "§3.4", "read_at": "2026-08-08T04:25:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — grade the draft, never fabricate a prospect fact.", "how_this_build_will_embody_it": "The prompt forbids invented facts; the parse degrades an empty shell to EMPTY." },
  { "id": "§5", "read_at": "2026-08-08T04:25:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — one verifiable, tested tool per unit, not a rushed whole.", "how_this_build_will_embody_it": "Phase 1b is one complete gated unit on the locked pattern; client deferred, not faked." },
  { "id": "§6", "read_at": "2026-08-08T04:25:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks understood-why, ripple trace, honesty rationale." },
  { "id": "A19", "read_at": "2026-08-08T04:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A21", "read_at": "2026-08-08T04:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "528-591", "why_it_governs": "One mechanism, not a fork — audit across modules for 'same feature, second copy'.", "how_this_build_will_embody_it": "The engine grounds via the shared methodologyBlock rather than inlining a second copy of sales principles." },
  { "id": "A22", "read_at": "2026-08-08T04:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T04:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate.", "how_this_build_will_embody_it": "The structural-honesty degrade is locked by a test that fails if an empty shell renders." },
  { "id": "A31", "read_at": "2026-08-08T04:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-920", "why_it_governs": "Schema-complete is not built — the client caller is not built yet.", "how_this_build_will_embody_it": "check.md labels this SUBSTRATE; the human-facing seam is Phase 2." },
  { "id": "A38", "read_at": "2026-08-08T04:25:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit 0." }
]
```
