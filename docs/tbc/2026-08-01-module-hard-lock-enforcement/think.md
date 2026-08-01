---
tbc_version: 1
trigger: feature
started_at: 2026-08-01T12:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 9
hypotheses: 1
---

# THINK — module hard-lock enforcement (Phase 5b/5c): migration + middleware

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (sha256sum in build.md).

## 2. Why (founder decision — hard lock)

Founder: a single-module pilot account must be confined to its module (land there, other modules hidden +
blocked). 0197 did SOFT landing only ("no unified module-gate"). This builds the gate.

## 3. Design + interconnection trace (holistic ripple)

- **Reliable signal:** `companies.access_module` (0207), set from the redeemed pilot code's module — NOT the
  care_tenant_config lever, which 0045 auto-creates for every company (verified live: it can't distinguish a
  C.A.R.E account). Column is RLS-readable by a member (0001 companies SELECT); pilot_codes is RLS-sealed
  (verify:live confirms deny-all), so the column is the only member-readable home for the signal.
- **Migration 0207:** add the nullable column + backfill existing redeemed single-module accounts + recreate
  redeem_pilot_code VERBATIM (statement-by-statement diff vs 0197 in check.md) + one addition that stamps
  access_module. Applied live; verify:live 22/22 still hold; backfill = 13 null / 1 sales_coach (matches the 1
  redeemed sales_coach code).
- **Enforcement in middleware:** it already has the pathname + session. After the existing auth redirect, for
  an authed user on /dashboard, ONE nested query reads the company's access_module; `redirectForLock` (the
  tested pure core) decides. FAIL-OPEN on error — a lookup hiccup never locks a legitimate user out (RLS still
  protects data; this gate is product-scoping). This also handles LANDING: a locked user hitting the hub is
  redirected to their module home.

## 4. Hypothesis

- **H1:** a sales_coach-locked account is redirected to /dashboard/sales-coach from any other /dashboard route;
  a null (complete/legacy) account is unaffected; verify:live stays 22/22; typecheck clean.

## 5. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-08-01T12:30:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding earned — read the 0197 RPC + resolveUserLanding + the middleware before building; discovered the care lever is broken by 0045 (verified live) and chose the reliable column instead.", "how_this_build_will_embody_it": "Section 3 records the reliable-signal reasoning." },
  { "id": "§0.1",   "read_at": "2026-08-01T12:30:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH via sha256sum." },
  { "id": "§1.5.1", "read_at": "2026-08-01T12:30:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Layer-3 — a locked user lands in their module and can't stray; the redirect keeps them flowing, not stalled on a forbidden page.", "how_this_build_will_embody_it": "Middleware redirect to moduleHome." },
  { "id": "§1.5.2", "read_at": "2026-08-01T12:30:00Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-search — verified the care lever's unreliability against the LIVE db before choosing the column, rather than trusting resolveUserLanding.", "how_this_build_will_embody_it": "check.md records the live backfill counts." },
  { "id": "§6",     "read_at": "2026-08-01T12:30:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — traced what the migration touches (companies + the DEFINER RPC) and confirmed the RPC recreate is verbatim + verify:live green.", "how_this_build_will_embody_it": "check.md's statement diff + verify:live 22/22." },
  { "id": "A19",    "read_at": "2026-08-01T12:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across entries." },
  { "id": "A22",    "read_at": "2026-08-01T12:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + the Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-08-01T12:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "31-32", "why_it_governs": "Don't ship a half-thing / don't lock a real user out — the guard fails OPEN on a lookup error so a hiccup never traps a paying user.", "how_this_build_will_embody_it": "The middleware try/catch fails open." },
  { "id": "A38",    "read_at": "2026-08-01T12:30:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run.", "how_this_build_will_embody_it": "check.md pastes tsc + verify:live + backfill output." }
]
```
