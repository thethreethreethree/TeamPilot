---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T05:14:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 14
hypotheses: 2
---

# THINK — Sales Coach Extension: shared refresh route + a detection-scope fix

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

## 2. The audit-scope finding (§1.5.2 proactive audit)
Building the sales refresh route, I checked invariant-audit INVARIANT 8 ("every extension route
authenticated") and found it scanned ONLY `src/app/api/care/extension/` (line 484). The five Sales Coach tool
routes under `coach/extension/` were therefore NOT covered — they ARE authenticated (all use
`guardExtensionRequest`), but the audit was not verifying them, so a FUTURE sales route that forgot the guard
would be an unguarded, uncapped LLM-cost + tenant-data surface the audit would miss. This is a scope gap: the
invariant did not grow when the parallel `coach/` namespace was added. Fixed by widening the scan regex to
`(care|coach)/extension/`.

## 3. The refresh route (A21 one mechanism)
The C.A.R.E refresh route is generic Supabase-token exchange with NO product coupling (no entitlement, no
tenant logic). Rather than fork it for sales, the logic is extracted to `refreshExtensionSession` and BOTH
routes call it; each supplies its own rate-limit id. The C.A.R.E route is refactored to use it with behavior
preserved (its existing test stays green). The new `/api/coach/extension/refresh` has no auth gate (the
refresh_token IS the credential) and is allowlisted in INVARIANT 8 with that different-auth-model reason —
exactly as the C.A.R.E refresh route already is.

## 4. Interconnection trace (§1.5)
- The extraction touches the C.A.R.E refresh route — its 6-case test must stay green (behavior identical).
- Widening INVARIANT 8 now scans 5 more routes; all pass (they use the guard); the new refresh route is
  allowlisted. The widening is self-proving: the refresh route WOULD be flagged (no guard) without its
  allowlist entry — that is the evidence the scan now reaches `coach/extension/`.
- No schema, no store — refresh is a stateless token proxy.

## 5. §5 — build what unblocks, not what over-reaches
The refresh route is infra Phase 2b's `background.js` needs; it is decision-INDEPENDENT (refresh ≠
entitlement). The connect page + token mint (the rest of the handoff) stay deferred + specced — not stubbed.

## 6. Hypotheses (§1.5.2)
- **H1 (C.A.R.E regression):** the extraction could change the C.A.R.E refresh behavior. Confirm: its 6-case
  route test stays green with no edit. **Held.**
- **H2 (scan really widened):** the regex change might not actually reach coach/extension. Confirm: the
  new refresh route (no guard) is flagged unless allowlisted — and the audit runs clean only WITH the
  allowlist entry, proving the scan reaches it. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T05:14:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — check the audit's scope before adding a route it should cover.", "how_this_build_will_embody_it": "Section 2 reads INVARIANT 8's scan glob and finds the coach/ gap." },
  { "id": "§0.1", "read_at": "2026-08-08T05:14:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T05:14:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — the extraction touches the C.A.R.E route + the shared invariant; neither may regress.", "how_this_build_will_embody_it": "Section 4 keeps the C.A.R.E test green and self-proves the widened scan." },
  { "id": "§1.5.1", "read_at": "2026-08-08T05:14:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 structure: one shared handler, two thin routes.", "how_this_build_will_embody_it": "build.md walks the extraction; the refresh routes are pure mappers over the shared handler." },
  { "id": "§1.5.2", "read_at": "2026-08-08T05:14:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — the proactive audit of the neighbouring invariant, not just the task, surfaced the scope gap.", "how_this_build_will_embody_it": "Section 2: checking INVARIANT 8 while adding a route caught the uncovered sales routes." },
  { "id": "§3.3", "read_at": "2026-08-08T05:14:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — the rest of the auth handoff (connect page) is flagged, not stubbed.", "how_this_build_will_embody_it": "Section 5 + the README defer the connect page as specced, not half-built." },
  { "id": "§5", "read_at": "2026-08-08T05:14:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — build the decision-independent unblocker, don't over-reach into the founder-gated handoff.", "how_this_build_will_embody_it": "Refresh (generic, decision-independent) is built; connect/entitlement stay out." },
  { "id": "§6", "read_at": "2026-08-08T05:14:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks the finding, the ripple, the A21 extraction, the scoped-out handoff." },
  { "id": "A19", "read_at": "2026-08-08T05:14:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A21", "read_at": "2026-08-08T05:14:00Z", "source_file": "ThinkerThinker.md", "line_range": "528-591", "why_it_governs": "One mechanism, not a fork — the refresh logic is generic; extract, don't duplicate.", "how_this_build_will_embody_it": "refreshExtensionSession is shared by both refresh routes; neither inlines the Supabase grant." },
  { "id": "A22", "read_at": "2026-08-08T05:14:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T05:14:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate. The 'authenticate every extension route' lesson only holds if the gate's SCOPE tracks the routes.", "how_this_build_will_embody_it": "Widening INVARIANT 8 makes the gate cover the new namespace; the refresh routes' behavior is test-locked." },
  { "id": "A31", "read_at": "2026-08-08T05:14:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-920", "why_it_governs": "Schema-complete is not built — assert the seam. The refresh route's caller is the (Phase 2b) extension.", "how_this_build_will_embody_it": "check.md asserts the route's behavior; its human caller (background.js) is honestly Phase 2b." },
  { "id": "A38", "read_at": "2026-08-08T05:14:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit 0." }
]
```
