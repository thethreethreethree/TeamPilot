---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T02:48:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 9
hypotheses: 1
---

# THINK — Sales Coach extension: add the 4 Tier-3 support-desk adapters (#16-19)

(Build `xh` — post-9 daily builds sort after `x9` as xa..xh.)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) recomputed this session, unchanged. The axioms cited in the
manifest (§6 below) were re-read this session during the immediately-preceding `xg` build (same continuous
session, <30 min ago); methodology is in the working tree (A19), cited from content not cached labels (A22).

## 2. Why this, and the honesty check on it (§1.5.2 + the volume-padding concern)
The founder's directive is "all top 20 communication platforms." `PLATFORM-COVERAGE.md` enumerates 19 named
platforms; 13 had adapters (7 Tier-1 + 6 Tier-2). Four named, reachable ones (#16-19: Zendesk, Intercom, Front,
Gorgias) were unbuilt. This build adds them.

The honest risk I interrogated first: is this genuine coverage or output-padding (adding volume to look busy)?
Two things resolve it in favor of genuine:
1. **Zero downside — each adapter self-gates by hostname.** `zendesk` fires only on `*.zendesk.com`, etc. A rep
   who never sells through a desk is completely unaffected: the adapter never runs. So inclusion is pure
   additive optionality, not a change to any existing path. (This also resolves the doc's old "include only if
   reps sell through them" caveat — inclusion costs nothing for reps who don't.)
2. **Not new guesses — reuse.** The selectors are copied verbatim from the live C.A.R.E desk adapters
   (`../extension/adapters.js`), minus the RCD/media path (sales reads text only). Same reasoned-then-confirm-
   live posture the founder already accepted for the whole extension; not a fresh speculative selector.

Deliberately NOT built: #14 Reddit (would be new reasoned selectors — real added uncertainty, no reuse) and
#15 Zoom Team Chat (the doc flags "confirm the web chat surface exists first" — unverified reachability).
Building those would cross from reuse into speculation, so they stay flagged, not shipped.

## 3. Interconnection trace (holistic)
- No manifest change: adapters inject via `activeTab` on toolbar click, so a per-site adapter needs no
  `host_permissions` entry (verified — Tier-1/2 sites aren't in host_permissions either). host_permissions
  stays `[localhost:4321, elostate.com]` (the API origins only).
- `content.js` unchanged: `captureConversation` already routes any `salesAdapterFor(host)` hit; the new keys
  flow through the existing path, including the capture-preview safety net just shipped in `xg`.
- Drift surfaces synced (comment-only sync contract discipline): the "13 platforms" count appears in
  `PLATFORM-COVERAGE.md`, `README.md`, `SALES-COACH-EXTENSION-STATUS.md` (×2) → all updated to 17. The
  consumer-facing download page keeps its deliberately-conservative Tier-1-only auto-read list (desks are
  unverified; don't advertise auto-read we haven't confirmed) — left intentionally unchanged.

## 4. Hypothesis (§1.5.2)
- **H1:** the four desks route correctly, including the `.endsWith()` wildcard predicates. Confirm: extend the
  existing vm execution-routing test with SUBDOMAIN cases (`acme.zendesk.com`→zendesk, `shop.gorgias.com`→
  gorgias) — a substring check can't catch a typo'd predicate; an execution route can. **Held** (routes added;
  the test loads adapters.js in a vm and asserts `salesAdapterFor(host).key`).

## 5. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T02:52:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — check the coverage record + interrogate the padding risk before adding adapters.", "how_this_build_will_embody_it": "Section 2 interrogates genuine-vs-padding before building; only reuse+self-gating adapters ship." },
  { "id": "§0.1", "read_at": "2026-08-08T02:52:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, hashes recomputed.", "how_this_build_will_embody_it": "Section 1 records the sha256 MATCH; axioms re-read this session." },
  { "id": "§1.5.1", "read_at": "2026-08-08T02:53:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L2 (does it actually work): route correctly, degrade safe.", "how_this_build_will_embody_it": "Execution-routing test (incl. wildcard predicates) proves L2; manual fallback + preview preserve continuity." },
  { "id": "§1.5.2", "read_at": "2026-08-08T02:53:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit + 'no license to refactor without need' — bound scope to reuse, not speculation.", "how_this_build_will_embody_it": "Reddit/Zoom (speculative) left unbuilt; only reuse+self-gating desks shipped." },
  { "id": "§6", "read_at": "2026-08-08T02:54:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think walks the coverage gap, the padding check, the ripple (docs sync), the scope boundary." },
  { "id": "A19", "read_at": "2026-08-08T02:57:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-476", "why_it_governs": "Methodology in the tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms opened this session." },
  { "id": "A22", "read_at": "2026-08-08T02:56:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-621", "why_it_governs": "Citations require session-reading; the manifest is the artifact.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a real in-session read timestamp." },
  { "id": "A30", "read_at": "2026-08-08T02:55:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-789", "why_it_governs": "Encode the class in a gate, not prose.", "how_this_build_will_embody_it": "Routing is execution-tested (wildcard subdomain cases), so a typo'd match predicate fails CI, not just review." },
  { "id": "A38", "read_at": "2026-08-08T02:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1020", "why_it_governs": "'Verified' = the canonical command by name, with its output.", "how_this_build_will_embody_it": "check.md pastes `npm run check` and its exit code." }
]
```
