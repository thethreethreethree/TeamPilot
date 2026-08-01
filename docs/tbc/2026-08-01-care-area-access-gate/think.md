---
tbc_version: 1
trigger: feature
started_at: 2026-08-01T14:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 9
hypotheses: 1
---

# THINK — C.A.R.E area access gate (completes the module-based access model)

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST (sha256sum in build.md).

## 2. Why (completes the founder's module-access directive, de-risked by §0)

Founder directive: module-based access, each client confined to its module. Audit found `/dashboard/care`
had NO page access gate (unlike `/dashboard/sales-coach`). §0 de-risk: the C.A.R.E DATA is ALREADY gated by
`requireCareAgent` (is_support_agent OR company admin) on every C.A.R.E API — so a non-care user already sees a
BROKEN CareShell (all API calls 403), not a leak. So a page gate changes NO ONE's access; it just redirects a
non-care user cleanly instead of showing a dead shell. That resolves the uncertainty that made this a founder
decision into a low-risk consistency + UX fix.

## 3. Design + interconnection (§1.5.1 layer-3, holistic ripple trace)

Mirror the sales-coach layout gate EXACTLY: server-side, read the profile, allow `is_support_agent OR role in
(CEO/COO/admin)` — the same predicate `requireCareAgent`/`resolveCareAgentAuth` compute (careAgentAuth.ts:29
`isAgent = !!isSupportAgent || isAdmin`), else `redirect("/dashboard")`. Interconnection with the 0207
module-lock: a care-provisioned pilot account is `role='admin'` (from redeem_pilot_code) so it passes the gate,
and the middleware separately confines it to /dashboard/care — consistent, no conflict. A sales_coach-locked
account never reaches this gate (the middleware redirects it to its own module first).

## 4. Hypothesis

- **H1:** a non-(admin|support-agent) user is redirected from /dashboard/care to /dashboard (clean, no shell
  flash); every legitimate care user (the API-gated set) still enters; typecheck clean.

## 5. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-08-01T14:00:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding earned — I read requireCareAgent's predicate + confirmed the API already gates the data before adding the page gate, which de-risked a founder-flagged decision into a no-access-change fix.", "how_this_build_will_embody_it": "Section 2 records the de-risk; the gate reuses the API predicate." },
  { "id": "§0.1",   "read_at": "2026-08-01T14:00:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH via sha256sum." },
  { "id": "§1.5.1", "read_at": "2026-08-01T14:00:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Layer-3/4 — a non-care user is redirected cleanly instead of stalled on a broken shell (workflow continuity + surface honesty).", "how_this_build_will_embody_it": "Server redirect to /dashboard." },
  { "id": "§1.5.2", "read_at": "2026-08-01T14:00:00Z", "source_file": "CLAUDE.md", "line_range": "120-140", "why_it_governs": "THINK-then-search — I searched the care access model (requireCareAgent) to pick the RIGHT predicate rather than invent one.", "how_this_build_will_embody_it": "The gate reuses is_support_agent OR admin, the API's predicate." },
  { "id": "§6",     "read_at": "2026-08-01T14:00:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — traced the interconnection with the module-lock middleware + the redeem role, confirming no conflict.", "how_this_build_will_embody_it": "Section 3 traces both." },
  { "id": "A19",    "read_at": "2026-08-01T14:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across entries." },
  { "id": "A22",    "read_at": "2026-08-01T14:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest + the Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-08-01T14:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "31-32", "why_it_governs": "Don't cry wolf / don't break a real user — the gate reuses the API's EXACT predicate, so no legitimate care user is denied (they already pass the API).", "how_this_build_will_embody_it": "Predicate parity with requireCareAgent; demo mode bypasses." },
  { "id": "A38",    "read_at": "2026-08-01T14:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run.", "how_this_build_will_embody_it": "check.md pastes typecheck output + the predicate-parity grep." }
]
```
