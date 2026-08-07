---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T06:50:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 15
hypotheses: 2
---

# THINK — Sales Coach Extension: connect handoff (Sign in end-to-end)

(Build `xe` — post-9 daily builds sort after `x9` as xa..xe.)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

## 2. The gap this closes (§0)
The downloadable extension (prior build) could install but not Sign in — the panel's Sign in opens
`/extension/connect`, which only served C.A.R.E. This wires the LAST piece: the connect page now serves the
sales extension too, so the full arc works — download → install → Sign in → use. It needs NO entitlement
decision (it delivers the Supabase session token; the tool routes enforce entitlement separately).

## 3. What this build is (A21 — one page, both products)
Rather than fork a sales connect page, the EXISTING `/extension/connect` is made product-parameterized:
`?product=sales` → it hands off with message type `sales-connect` (which the worker listens for) and pins to
`NEXT_PUBLIC_SALES_EXTENSION_ID`; no `product` → byte-for-byte the original C.A.R.E behavior (`care-connect`,
`NEXT_PUBLIC_CARE_EXTENSION_ID`). Plus: the new env var added to `.env.example` + the INV9 NEXT_PUBLIC
allowlist, and a cross-artifact guard that the connect message type matches the worker's listener.

## 4. Interconnection trace (§1.5) — C.A.R.E preserved
- The connect page is shared. The change is default-preserving (product defaults to "care" → unchanged
  strings, unchanged message type, unchanged pinned id). The C.A.R.E connect flow is untouched.
- The token-handoff SECURITY is preserved per product: the token goes ONLY to the pinned official extension
  id (or, when unset in dev, hands off but warns) — the same anti-exfiltration posture, now per-product.
- New NEXT_PUBLIC var → INV9 allowlist + .env.example (the env-docs guard caught the missing doc — added).

## 5. §3.4 / security — the handoff is pinned, not open
`?ext=<id>` is attacker-controllable; the page hands off ONLY to the product's pinned id (when set). Sales
gets its own pin so a lure can't route a sales rep's token to another extension. Honest about the dev case
(unset id → hand off + warn), same as C.A.R.E.

## 6. Hypotheses (§1.5.2)
- **H1 (C.A.R.E regression):** parameterizing the shared page could change C.A.R.E behavior. Confirm: product
  defaults to care; the care-connect string + care env are preserved; the C.A.R.E connect tests + the auth
  tests stay green. **Held.**
- **H2 (silent auth failure):** the connect message type must match the worker's listener or Sign in
  delivers a token the worker ignores. Confirm: the guard asserts the page emits `sales-connect` AND the
  worker listens for exactly `sales-connect` AND opens `?product=sales`. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T06:50:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — read the C.A.R.E connect page's handoff + security before extending it.", "how_this_build_will_embody_it": "Section 2/3 trace the existing handoff and extend it product-aware." },
  { "id": "§0.1", "read_at": "2026-08-08T06:50:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T06:50:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — the connect page is shared with C.A.R.E; the change must not regress it.", "how_this_build_will_embody_it": "Section 4: default-preserving; C.A.R.E strings/type/env unchanged." },
  { "id": "§1.5.1", "read_at": "2026-08-08T06:50:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L3 continuity: Sign in must leave the rep flowing (connected → close tab → use).", "how_this_build_will_embody_it": "build.md walks the arc; the page shows a Connected state + a manual fallback." },
  { "id": "§1.5.2", "read_at": "2026-08-08T06:50:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesize C.A.R.E-regression + silent-auth-failure before shipping.", "how_this_build_will_embody_it": "Section 6 states H1/H2 with the confirming guard." },
  { "id": "§3.3", "read_at": "2026-08-08T06:50:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — the icon + entitlement-source are flagged as founder calls, not faked.", "how_this_build_will_embody_it": "closure.md flags the icon + entitlement decision as founder follow-ups." },
  { "id": "§3.4", "read_at": "2026-08-08T06:50:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty/security — a session token must go only to the pinned official extension, not any URL-supplied id.", "how_this_build_will_embody_it": "Section 5: the handoff pins per-product; dev-unset hands-off-but-warns, honestly." },
  { "id": "§5", "read_at": "2026-08-08T06:50:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — extend the shared mechanism, don't fork; gate the commit on a real green.", "how_this_build_will_embody_it": "A21 one-page approach; the env-docs failure was fixed + the gate re-run to exit 0 before committing." },
  { "id": "§6", "read_at": "2026-08-08T06:50:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks the gap, the A21 extension, the security, the hypotheses." },
  { "id": "A19", "read_at": "2026-08-08T06:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A21", "read_at": "2026-08-08T06:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "528-591", "why_it_governs": "One mechanism, not a fork — one product-parameterized connect page serves both extensions.", "how_this_build_will_embody_it": "The C.A.R.E page is extended, not duplicated; default-preserving." },
  { "id": "A22", "read_at": "2026-08-08T06:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T06:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate. The connect↔worker message-type contract is locked by a test.", "how_this_build_will_embody_it": "The guard fails if the page's connect type and the worker's listener drift apart." },
  { "id": "A31", "read_at": "2026-08-08T06:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-920", "why_it_governs": "Schema-complete is not built — assert the Sign-in seam: panel → open-connect → connect page → sales-connect → worker stores.", "how_this_build_will_embody_it": "check.md asserts the message-type match + product=sales open; the browser round-trip is founder-live." },
  { "id": "A38", "read_at": "2026-08-08T06:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code — gated on the REAL exit.", "how_this_build_will_embody_it": "check.md pastes npm run check exit 0, re-run after fixing the env-docs failure (captured rc, gated)." }
]
```
