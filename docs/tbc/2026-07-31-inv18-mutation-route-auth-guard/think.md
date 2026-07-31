---
tbc_version: 1
trigger: feat
started_at: 2026-07-31T11:05:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 2
---

# THINK — INV18: every non-public mutation route references a recognised auth/tenant gate

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json.

## 2. Why (A30 — the fix is not complete until the class is gated)

Earlier this session I found + fixed `diagnosis/close` (commit 4ab3294c): a mutation route that wrote
to the append-only resolutions+events chain (Rule 3.1) with NO route-layer auth, saved today only by
`close_problem()` being SECURITY INVOKER + `problems`-RLS failing closed. It was caught by a MANUAL
no-auth sweep + sibling-asymmetry — not a structural guard. Per A30, a fix is incomplete until the
CLASS is encoded in a gate that fails without the author's cooperation. INV18 is that gate: it prevents
the NEXT diagnosis/close from shipping silently.

This is the discipline in [[feedback_convert_verification_to_structural_guard]] ("convert a verified
finding into a structural guard; ALWAYS detection-test it; keep it precise") and generalises the
existing INV7 (admin routes) + INV8 (extension routes) to every mutation route in the tree.

## 3. Design (grounded in a full inventory, §0 — not a guess)

I enumerated EVERY `src/app/api/**/route.ts` exporting POST/PATCH/PUT/DELETE (≈170 routes) and its
actual auth mechanism from the source. Findings:

- The vast majority reference a recognised gate: a session (`auth.getUser` / `getCurrentCompanyId` /
  `getCurrentAuthContext`), a role gate (`requireCareAgent` / `requireVendorAdmin`), a per-conversation
  capability token (`getCareConversationByToken`), or a shared secret (`CRON_SECRET` / `SWEEP_SECRET` /
  `CARE_INBOUND_EMAIL_SECRET`). These form `ROUTE_AUTH_RE`.
- Exactly 10 are intentionally public. Each was individually VERIFIED safe-to-be-anonymous before being
  allowlisted (the RES-02 risk was that a wrong allowlist entry green-lights a real gap):
  - 4 `ai/*` — deprecated static stubs (`POST()`, no req, no LLM, no data).
  - `llm/ping` — rate-limited provider health check (no tenant data).
  - `pilot/validate` — pre-auth by design (code entry before an account exists); rate-limited 20/min,
    read-only `pilot_code_status()` returns only {valid, module, redeemed}, no PII, no mutation.
  - `sales/demo/roleplay` — public demo, double rate-limited + maxDuration-bounded, LLM sees only
    roleplay text.
  - `care/conversations`, `care/demo/ask`, `care/widget/presence` — public chat-widget/demo endpoints
    scoped by `resolveCareTenant` (embed token) + rate-limited; a website visitor is anonymous BY DESIGN.

- `resolveCareTenant` is deliberately EXCLUDED from `ROUTE_AUTH_RE`. It is tenant RESOLUTION for public
  widgets, not a session gate, so its 3 routes are allowlisted individually — which forces a FUTURE
  resolveCareTenant route to be consciously classified rather than passing silently.
- Paths already covered by a dedicated invariant are skipped: `admin/` (INV7), `care/extension/` (INV8),
  `*-cron` (INV11).

## 4. The risk this guard must not create (§5 — the builder under pressure)

The failure mode of an allowlist-backed guard is a FALSE ACCEPT: allowlisting a route that is actually a
gap green-lights a hole (exactly how INVARIANT 4 once read revoke-TEXT not the effective grant). Defense:
(a) every allowlist entry carries an explicit safety justification the founder can veto; (b) the self-test
asserts the matcher REJECTS an ungated body and ACCEPTS each real gate shape; (c) an end-to-end detection
test (a real temp route) confirms the guard FIRES, not just that the regex matches a string.

## 5. Hypotheses

- **H1:** With `ROUTE_AUTH_RE` + the 10-entry allowlist, the audit reports 0 violations on the current
  tree (every real route is correctly classified — no false positive on a gated route, no false negative).
- **H2:** A synthetic ungated mutation route makes INV18 FIRE (exit-non-clean finding naming the file);
  a GET-only version does NOT fire (scope is mutation-only).

## 6. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-31T11:05:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding precedes solving — I enumerated all ~170 mutation routes + each one's real auth mechanism from source before writing the matcher/allowlist, rather than guessing a regex.", "how_this_build_will_embody_it": "Section 3 is grounded in the full inventory; 0 false positives confirms the classification." },
  { "id": "§0.1",   "read_at": "2026-07-31T11:05:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the working tree, read this session, not cached labels.", "how_this_build_will_embody_it": "Doc integrity MATCH; this-session read_at on every entry." },
  { "id": "§1.5.1", "read_at": "2026-07-31T11:05:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Four layers — a guard is worthless if its structure (layer 1) mis-classifies real routes; I built the inventory foundation before the matcher.", "how_this_build_will_embody_it": "The matcher rests on the verified inventory; self-test locks both directions." },
  { "id": "§1.5.2", "read_at": "2026-07-31T11:05:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK then search — I hypothesised which routes could be unguarded, then read each one's source to confirm before allowlisting.", "how_this_build_will_embody_it": "Each of the 10 public routes was individually verified safe (section 3), not waved through." },
  { "id": "§5",     "read_at": "2026-07-31T11:05:00Z", "source_file": "CLAUDE.md", "line_range": "334-346", "why_it_governs": "The builder under pressure is the risk — an allowlist-backed guard's failure mode is a false-accept that green-lights a hole (how INVARIANT 4 once passed a real gap).", "how_this_build_will_embody_it": "Section 4 names the false-accept risk; every allowlist entry carries a justification + the self-test asserts rejection of an ungated body." },
  { "id": "§6",     "read_at": "2026-07-31T11:05:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — traced what the guard affects (npm run check + pre-commit blast radius) and explained the why (A30 class-gating), not just the what.", "how_this_build_will_embody_it": "build.md states both read/write paths; the commit explains the A30 rationale." },
  { "id": "A19",    "read_at": "2026-07-31T11:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "The governing methodology assets were read from the tree this session, not recalled.", "how_this_build_will_embody_it": "This-session read_at across all 11 entries." },
  { "id": "A22",    "read_at": "2026-07-31T11:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Constitutional citations without session-reading are undetected violations — each § in the guard's comments + docs gets a manifest entry.", "how_this_build_will_embody_it": "This manifest + the commit's inline Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-07-31T11:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "91-93", "why_it_governs": "A fix is not complete until the class is encoded in a gate that fails without the author's cooperation — this guard IS that gate for the diagnosis/close class.", "how_this_build_will_embody_it": "INV18 fails the build (exit 1) on the next ungated mutation route; detection-tested end-to-end." },
  { "id": "A36",    "read_at": "2026-07-31T11:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "94-96", "why_it_governs": "The residual is the highest-yield queue — write it as a schema'd, confidence-ranked entry read from the top, not a disclaimer.", "how_this_build_will_embody_it": "closure.md's residual ranks the reference-not-ordering boundary + the self-authored-allowlist judgment, top entry opened." },
  { "id": "A38",    "read_at": "2026-07-31T11:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command actually run — assurance words sit beside pasted output + exit code.", "how_this_build_will_embody_it": "check.md pastes the detection-test output (fires on a probe, ignores GET) at exit 0." }
]
```
