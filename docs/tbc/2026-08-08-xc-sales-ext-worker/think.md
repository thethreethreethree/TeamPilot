---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T06:18:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 14
hypotheses: 2
---

# THINK — Sales Coach Extension, Phase 2b-worker: the service worker

(Build named `xc`, after `xb`/`xa` — post-9 daily builds sort after `x9` only as xa/xb/xc; see the
build-dir lexicographic-sort reference from an earlier build.)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

## 2. Correcting my own over-conservative deferral (§0 understand-before-solving)
I had deferred the ENTIRE browser client as "unverifiable in the sandbox, so I shouldn't build it." That
conflates two things. The project's OWN precedent disproves it: the C.A.R.E extension's background/content/
adapters all live in the repo, written and shipped as reasoned-but-UNVERIFIED, founder-confirmed live. The
honest rule is not "don't write browser code I can't runtime-test" — it is "don't CLAIM it works." Building
the client, clearly labeled and structurally parity-checked against the working sibling, IS the founder's
priority build, and following the established pattern. So the worker gets built now.

## 3. What this build is
`extension-sales/background.js` — the MV3 service worker, ported from `../extension/background.js`:
- keep: toolbar-click inject, the tool proxy (CORS-free worker fetch), the connect handoff, the badge, silent
  token refresh (via the coach refresh route — §A21, shares `refreshExtensionSession`).
- DROP: all `care-rcd-*` and `care-image-*` handlers (the sales extension has no conversation-capture).
- adapt: message types (`sales-tool`/`sales-connect`), storage keys (`salesCoachToken`), and the endpoint
  allowlist (`/^\/api\/coach\/extension\/[a-z]+$/`).
Plus a static port-completeness guard test (no C.A.R.E leftovers; the allowlist admits the real tool routes
and rejects traversal/cross-host).

## 4. Interconnection trace (§1.5)
- Calls only the built coach tool routes + the built coach refresh route — nothing new server-side.
- Reuses the connect-page handoff pattern (message type distinct so ONE connect page can serve both
  extensions by `product`). The connect PAGE itself is still to build (needs no entitlement decision — it
  just delivers the Supabase token; entitlement is checked at the tool routes).

## 5. §5 honesty — labeled, not claimed
The worker is RUNTIME-UNVERIFIED (Chrome APIs, no browser here). The file header + the README + this record
say so plainly. What CAN be checked here is checked: JS syntax, the security allowlist against the real
routes, no C.A.R.E leftovers, structural parity. The runtime is founder-confirmed live — the C.A.R.E posture.

## 6. Hypotheses (§1.5.2)
- **H1 (half-done port):** a leftover `care-tool`/`careToken`/RCD handler would be a silent port bug. Confirm:
  the guard test asserts none remain + the sales types/keys are present. **Held.**
- **H2 (open-proxy):** the tool proxy must not call an arbitrary URL. Confirm: `ALLOWED_ENDPOINT` admits the 5
  tool routes and rejects traversal + cross-host; the guard exercises the real regex. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T06:18:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — re-examine WHY I deferred the client and whether the precedent permits it.", "how_this_build_will_embody_it": "Section 2 corrects the over-conservative deferral against the C.A.R.E precedent." },
  { "id": "§0.1", "read_at": "2026-08-08T06:18:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T06:18:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — the worker touches the tool routes, the refresh route, the connect handoff.", "how_this_build_will_embody_it": "Section 4 traces each; nothing new server-side, reuses the shared refresh." },
  { "id": "§1.5.1", "read_at": "2026-08-08T06:18:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 structure (port parity) + L2 effect (bounded by what's verifiable without a browser).", "how_this_build_will_embody_it": "build.md walks the layers; L2 runtime is honestly labeled founder-live." },
  { "id": "§1.5.2", "read_at": "2026-08-08T06:18:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesize half-done-port + open-proxy before shipping the worker.", "how_this_build_will_embody_it": "Section 6 states H1/H2 with the confirming guard test." },
  { "id": "§3.3", "read_at": "2026-08-08T06:18:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — the remaining client pieces are flagged + sequenced, not silently implied done.", "how_this_build_will_embody_it": "closure.md flags content.js/adapters/connect/icons as residual, and check.md names them as not-built." },
  { "id": "§5", "read_at": "2026-08-08T06:18:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — build the priority honestly (labeled unverified), don't claim runtime it doesn't have.", "how_this_build_will_embody_it": "Section 5: verify what's verifiable; label the runtime boundary; founder-confirms live." },
  { "id": "§6", "read_at": "2026-08-08T06:18:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks the deferral-correction, the port scope, the honesty boundary." },
  { "id": "A19", "read_at": "2026-08-08T06:18:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A21", "read_at": "2026-08-08T06:18:00Z", "source_file": "ThinkerThinker.md", "line_range": "528-591", "why_it_governs": "One mechanism, not a fork — the worker's refresh reuses the coach refresh route (shared handler), not a copy.", "how_this_build_will_embody_it": "salesFetch calls /api/coach/extension/refresh, which shares refreshExtensionSession." },
  { "id": "A22", "read_at": "2026-08-08T06:18:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T06:18:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate. The port-completeness + allowlist are locked by a test, not a comment.", "how_this_build_will_embody_it": "The guard test fails on a C.A.R.E leftover or an allowlist that admits a bad path." },
  { "id": "A31", "read_at": "2026-08-08T06:18:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-920", "why_it_governs": "Schema-complete is not built — the worker is one piece; the panel + connect page + adapters remain.", "how_this_build_will_embody_it": "check.md names exactly what's built vs still-to-port; the worker alone isn't a loadable extension." },
  { "id": "A38", "read_at": "2026-08-08T06:18:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code — and only over what it actually covers.", "how_this_build_will_embody_it": "check.md pastes npm run check exit 0 AND is explicit the runtime Chrome-API behavior is NOT in its scope." }
]
```
