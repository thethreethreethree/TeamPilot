---
tbc_version: 1
trigger: feature
started_at: 2026-07-28T15:40:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 4
---

# THINK — founder-only download link for the build manual

Founder request: a downloadable link to the "Build a SaaS" manual PDF, **founder-only**, at
`/founder/files/buildmanual`.

## 1. Document integrity (§0.1)

Hashes match `docs/tbc/DOC_MANIFEST.json` (CLAUDE.md e08874… / TT 0428b0bb…). Proceed.

## 2. Session-read manifest (A22)

```json
[
  { "id": "§0",     "read_at": "2026-07-28T15:45:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understand before solving — the core risk here is authz (who is 'the founder'), so it must be diagnosed against the existing model, not invented.", "how_this_build_will_embody_it": "The founder gate reuses the audited vendor-admin predicate rather than a new ad-hoc check." },
  { "id": "§0.1",   "read_at": "2026-07-28T15:45:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology read this session; the manifest records the reads behind an access-control change.", "how_this_build_will_embody_it": "read_at is this session; ranges gate-checked." },
  { "id": "§1.5.1", "read_at": "2026-07-28T15:45:00Z", "source_file": "CLAUDE.md", "line_range": "78-90",   "why_it_governs": "Four layers — a download link is user-facing; layer 2 (does the gated download actually deliver the file) and layer 3 (the link is discoverable by the founder, hidden from others) are the whole feature.", "how_this_build_will_embody_it": "Section 5 walks the layers; the page links the route, the route serves the bytes." },
  { "id": "§1.5.2", "read_at": "2026-07-28T15:45:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK then search — the authz mechanism was hypothesised and confirmed by reading vendorAuth.ts before writing the gate.", "how_this_build_will_embody_it": "Hypotheses below were formed against the surface; the gate one is confirmed." },
  { "id": "§6",     "read_at": "2026-07-28T15:45:00Z", "source_file": "CLAUDE.md", "line_range": "352-368", "why_it_governs": "The checklist — item on real-vs-incidental constraints: 'founder-only' is a real security constraint, respected with a fail-closed gate, not approximated.", "how_this_build_will_embody_it": "Any uncertainty in the gate denies (requireVendorAdmin fails closed)." },
  { "id": "A19",    "read_at": "2026-07-28T15:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Methodology in the working tree — read live, recorded here.", "how_this_build_will_embody_it": "This-session reads recorded." },
  { "id": "A22",    "read_at": "2026-07-28T15:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-615", "why_it_governs": "Citations without session-reading are undetected violations; this manifest makes the reads checkable.", "how_this_build_will_embody_it": "Every cited id resolves to a this-session entry here." },
  { "id": "A28",    "read_at": "2026-07-28T15:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "A precedent already decides 'who is the vendor/founder': requireVendorAdmin (CRM gate, fixed 0089). This is an ALIGNMENT to that gate, not a new founder-check to invent.", "how_this_build_will_embody_it": "The route uses requireVendorAdmin; the page uses the same isVendorAdmin predicate." },
  { "id": "A30",    "read_at": "2026-07-28T15:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "The gate must fail without cooperation — reusing the single-source vendor gate means the founder-only rule cannot silently drift from the CRM's.", "how_this_build_will_embody_it": "One predicate (vendorAuth) guards both the page and the route." },
  { "id": "A31",    "read_at": "2026-07-28T15:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-820", "why_it_governs": "Schema-complete is not built — a download PAGE with no working route, or a route that can't read its bytes, is a dead link. Both directions must work.", "how_this_build_will_embody_it": "build.md asserts: the page's link (write/discover path) and the route returning the exact PDF bytes (read path), both proven." },
  { "id": "A38",    "read_at": "2026-07-28T15:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1025", "why_it_governs": "'Verified' is a command — the build closes only after npm run check runs by name with its exit code pasted, plus the base64 round-trip proof.", "how_this_build_will_embody_it": "closure.md pastes the canonical command output." }
]
```

## 3. Hypotheses

```json
[
  { "id": "H1", "claim": "There is an existing, audited gate for 'is the founder / vendor', so I must reuse it, not invent a founder-email check.", "confidence": "high", "test": "Read src/lib/crm/vendorAuth.ts.", "outcome": "CONFIRMED — requireVendorAdmin(): admin AND company === vendor company; fails closed; identical error hides existence. Fixed in 0089." },
  { "id": "H2", "claim": "Embedding the PDF as base64 decodes to the exact original bytes.", "confidence": "high", "test": "Decode manual-data.ts and compare byte count + %PDF header.", "outcome": "CONFIRMED — 374419 bytes, matches the PDF, starts with %PDF." },
  { "id": "H3", "claim": "A repo-file fs read would 500 in production under output:'standalone' (no file tracing), so base64 is the safe choice for 'don't break'.", "confidence": "medium", "test": "Read next.config (output mode, no outputFileTracingIncludes) + note no repo-file-serving precedent (existing byte routes generate or use storage).", "outcome": "CONFIRMED enough to justify base64 — output:standalone, no tracing config, no precedent for reading a static repo file at runtime." },
  { "id": "H4", "claim": "A non-founder (customer admin or public) cannot reach the file OR learn it exists.", "confidence": "high", "test": "Gate: route returns 403 (identical message) for non-vendor-admins; page calls notFound() (404).", "outcome": "BUILT — route requireVendorAdmin, page isVendorAdmin+notFound. Verified by reading the gate's own posture (fail-closed, no-leak)." }
]
```

## 4. Spec fidelity

- **Restated:** a founder-only downloadable link to the build-manual PDF at `/founder/files/buildmanual`.
- **As written.** The only design choice — base64 embed vs disk read — is decided by the "don't break in production" constraint the founder set, plus the absence of a repo-file-serving precedent; recommended and taken, not silently substituted.
- **Precedent (A28):** requireVendorAdmin decides "founder-only." No new founder-identity mechanism invented. No founder decision to flag.

## 5. Four-layer pre-walk (§1.5.1)

- **1 structure:** one gated route (download) + one gated page (discovery), sharing the audited vendor-admin predicate. PDF embedded so serving is deployment-agnostic.
- **2 effectivity:** invoked as the founder invokes it — visiting `/founder/files` shows the link; clicking downloads the exact PDF. A customer gets 404/403.
- **3 composition:** the founder lands on `/founder/files`, sees the manual, clicks, gets the file — a complete flow, no dead end. A non-founder is turned away with no signal the file exists.
- **4 surface:** on-brand page (bg-base, glass-card, ember button), consistent with the app.

**verdict: SHIPPABLE.**
