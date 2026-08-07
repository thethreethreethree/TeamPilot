---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T04:45:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 14
hypotheses: 2
---

# THINK — Sales Coach Extension, Phase 2a: standalone client core (manifest + wired config)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

## 2. Where this sits (§0)
Phase 1 built the 4 server tools. Phase 2 is the standalone CLIENT (founder chose separate, not a mode). The
whole client runtime (background/content/adapters) is UNVERIFIABLE in this no-browser sandbox. So this phase
ships only the pieces that are (a) sales-specific and (b) statically verifiable — `manifest.json` and
`config.js` (`SALES_TOOLS`) — plus a drift guard, and precisely specs the unverifiable runtime port.

## 3. What this build is
- `extension-sales/manifest.json` — MV3, sales-branded, same host permissions as the C.A.R.E extension.
- `extension-sales/config.js` — `SALES_TOOLS` (4 tools) wired to `/api/coach/extension/{summarize,dissect,
  coach,copilot}`, with DISTINCT token key + injection guard + tools global so both extensions coexist.
- `extension-sales/README.md` — honest status table (what's built vs the not-yet-ported runtime) + the
  well-scoped Phase 2b port plan, including the auth (connect/refresh) dependency that must be built.
- `salesExtensionConfigWiring.test.ts` — the drift guard.

## 4. Interconnection trace (§1.5)
- The config's endpoints are the ONLY cross-artifact contract that can silently rot (a typo, or a tool for a
  route that was never built). The drift guard binds config → the real route files. Nothing else here has a
  runtime dependency yet (the runtime port is deferred + specced).
- DISTINCT storage/global keys mean installing this alongside the C.A.R.E extension can't clobber its state.

## 5. §5 honesty — do NOT fake a working extension
The runtime can't run in the sandbox and the package is NOT yet loadable (no background/content/adapters, no
auth handoff). The README says so plainly and the port is specced, not stubbed. Blindly copying ~1400 lines
of browser JS that references unbuilt endpoints would be the dead-broken-surface the drift guard exists to
prevent (A31). Better a small verified core + an honest spec than a large unverifiable copy.

## 6. Hypotheses (§1.5.2)
- **H1 (dead tool button):** a tool could point at a route that doesn't exist and ship as a live-looking
  button. Confirm: the drift guard asserts every endpoint has a route.ts; a bad endpoint fails the gate.
  **Held.**
- **H2 (coexistence clobber):** sharing storage/global keys with the C.A.R.E extension would break both.
  Confirm: the guard asserts salesCoachToken / __salesCoachConfigLoaded / SALES_TOOLS are all distinct.
  **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T04:45:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — establish what is verifiable vs not before writing client files.", "how_this_build_will_embody_it": "Section 2 splits the client into the verifiable core (this phase) and the unverifiable runtime (deferred)." },
  { "id": "§0.1", "read_at": "2026-08-08T04:45:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T04:45:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — the config↔route contract and the coexistence-with-C.A.R.E seam must not silently break.", "how_this_build_will_embody_it": "Section 4 traces both; the drift guard binds them." },
  { "id": "§1.5.1", "read_at": "2026-08-08T04:45:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 structure (the package layout) + L4 surface (the tool labels the rep sees).", "how_this_build_will_embody_it": "build.md notes the package structure; the runtime L2/L3 are deferred + specced." },
  { "id": "§1.5.2", "read_at": "2026-08-08T04:45:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesize dead-tool + coexistence-clobber before building.", "how_this_build_will_embody_it": "Section 6 states H1/H2 with the confirming guard." },
  { "id": "§3.3", "read_at": "2026-08-08T04:45:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — the deferred runtime is flagged + specced, not silently omitted or half-stubbed.", "how_this_build_will_embody_it": "The README status table + Phase 2b spec make the boundary explicit." },
  { "id": "§3.4", "read_at": "2026-08-08T04:45:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — the package must not look more complete than it is.", "how_this_build_will_embody_it": "The README states NOT-yet-loadable plainly; the drift guard prevents a dead tool looking live." },
  { "id": "§5", "read_at": "2026-08-08T04:45:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — don't fake a working extension to look productive.", "how_this_build_will_embody_it": "Section 5: a small verified core + honest spec beats a large unverifiable copy." },
  { "id": "§6", "read_at": "2026-08-08T04:45:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks understood-why, the verifiable/unverifiable split, the honesty rationale." },
  { "id": "A19", "read_at": "2026-08-08T04:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A22", "read_at": "2026-08-08T04:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T04:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate. The 'don't ship a dead tool' + 'don't clobber the sibling extension' lessons must be a test, not a README note.", "how_this_build_will_embody_it": "The drift guard turns both into failing tests rather than prose reminders." },
  { "id": "A31", "read_at": "2026-08-08T04:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-920", "why_it_governs": "Schema-complete is not built — a tool button with no route is the dead-config instance of exactly this.", "how_this_build_will_embody_it": "The drift guard asserts config→route so no tool ships without its route; the runtime seam is honestly labeled unwired." },
  { "id": "A38", "read_at": "2026-08-08T04:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit 0, and is explicit that the runtime is NOT covered by it." }
]
```
