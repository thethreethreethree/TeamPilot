---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T06:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 15
hypotheses: 2
---

# THINK — Sales Coach Extension: downloadable package + install page (founder request)

(Build `xd` — post-9 daily builds sort after `x9` only as xa/xb/xc/xd.)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

## 2. The founder's request (spec fidelity — build as asked)
Verbatim: "Please include the Sales Extension to the Sales Coach page similar to the C.A.R.E extension. We
need a download link and an install instruction." So: mirror the C.A.R.E download flow for the sales
extension, and surface it on the Sales Coach page. The C.A.R.E flow (understood from the code): a build
script produces a prod-hardened zip served from /public; a /extension/download page gives the download
button + click-by-click install steps; other pages link to it.

## 3. What this build is
- **Completes the extension package** so the zip actually LOADS: `content.js` (the panel) + `adapters.js`
  (the 7 Tier-1 per-site readers) + placeholder `icons/` (copied from C.A.R.E; the manifest references them —
  the founder can rebrand). With the worker (prior build), config, and manifest, the package is now loadable.
- **`scripts/build-sales-extension-download.mjs`** — mirrors the C.A.R.E build: strips localhost, validates
  (mv3 / 128-icon / description<132), zips `extension-sales/` → `public/sales-coach-extension.zip`,
  deterministic. Wired into `prebuild` alongside the C.A.R.E one.
- **`/extension/download-sales`** — the download + install page (mirrors C.A.R.E, sales-branded, version
  single-sourced from the manifest).
- **The Sales Coach dashboard page** links to it (mobile + desktop).

## 4. Interconnection trace (§1.5)
- The download page + Sales Coach links are new GET surfaces (no mutation, no new auth). The zip is a static
  artifact regenerated deterministically on prebuild (no git churn).
- The client files ship in the zip; the guard test locks their port-completeness. The manifest's description
  was 142 chars (> the CWS 132 cap the C.A.R.E validator enforces) — shortened.

## 5. §3.4 honesty — what's real vs placeholder
The icons are C.A.R.E placeholders (labeled; a sales design is a founder follow-up). The client runtime is
browser-unverified (labeled in the files + the download page's "Good to know"). The download + build are
REAL and checked (the zip builds, is prod-stripped, and loads structurally).

## 6. Hypotheses (§1.5.2)
- **H1 (broken zip):** a missing file or leftover localhost would ship a non-loadable/rejected package.
  Confirm: the build validates (all files present, localhost stripped, description<132) and the guard asserts
  the zip exists + the page links it; I loaded the built zip and checked its contents. **Held.**
- **H2 (dead link):** the Sales Coach page could link a page/zip that doesn't exist. Confirm: the guard
  asserts the SC page links /extension/download-sales AND the page links /sales-coach-extension.zip AND the
  zip exists. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — read the C.A.R.E download flow before mirroring it.", "how_this_build_will_embody_it": "Section 2 traces the C.A.R.E build/page/link flow from the code first." },
  { "id": "§0.1", "read_at": "2026-08-08T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — the download surfaces, the prebuild, the served zip must not break other things.", "how_this_build_will_embody_it": "Section 4 traces each; deterministic zip, no new auth/mutation." },
  { "id": "§1.5.1", "read_at": "2026-08-08T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — this is USER-FACING (a download link + install steps); L3 continuity (download→install→sign-in→use) and L4 surface matter.", "how_this_build_will_embody_it": "build.md walks all four; the page leaves the user in a flowing install→sign-in state." },
  { "id": "§1.5.2", "read_at": "2026-08-08T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesize broken-zip + dead-link before shipping the download.", "how_this_build_will_embody_it": "Section 6 states H1/H2 with the confirming build validation + guard." },
  { "id": "§3.3", "read_at": "2026-08-08T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — the placeholder icon + the entitlement 402 are flagged, not silently faked.", "how_this_build_will_embody_it": "closure.md flags the icon rebrand + the connect handoff as follow-ups." },
  { "id": "§3.4", "read_at": "2026-08-08T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — don't present placeholder icons or unverified runtime as finished.", "how_this_build_will_embody_it": "Section 5 + the download page label the placeholder icon + the read-only-on-request behavior honestly." },
  { "id": "§5", "read_at": "2026-08-08T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — build the founder's ask honestly; verify what's verifiable (the build), label the rest.", "how_this_build_will_embody_it": "The build/zip/link are verified; the client runtime is labeled founder-live." },
  { "id": "§6", "read_at": "2026-08-08T06:30:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks the request, the mirror, the honesty boundary, the hypotheses." },
  { "id": "A19", "read_at": "2026-08-08T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A21", "read_at": "2026-08-08T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "528-591", "why_it_governs": "One mechanism, not a fork — the sales build mirrors the C.A.R.E build's strip/validate/zip approach and the shared refresh; adapters reuse the C.A.R.E selectors.", "how_this_build_will_embody_it": "The build script + adapters follow the C.A.R.E patterns, not novel forks." },
  { "id": "A22", "read_at": "2026-08-08T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate. The client port-completeness + download wiring are locked by a test.", "how_this_build_will_embody_it": "salesExtensionClientWiring.test.ts fails on a C.A.R.E leftover, a wrong result-shape, a missing zip, or a dead link." },
  { "id": "A31", "read_at": "2026-08-08T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-920", "why_it_governs": "Schema-complete is not built — assert the seam: a rep can find the link (SC page), download (page→zip), and the zip is real.", "how_this_build_will_embody_it": "check.md asserts SC-page→download-page→zip→exists; the runtime install is founder-live." },
  { "id": "A38", "read_at": "2026-08-08T06:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name + the ad-hoc build check, over what they actually cover.", "how_this_build_will_embody_it": "check.md pastes npm run check exit 0 + the zip-content check; the Chrome install itself is founder-live." }
]
```
