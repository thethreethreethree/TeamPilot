---
tbc_version: 1
trigger: fix
started_at: 2026-08-11T18:05:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — Sweep the raw-error-FIELD CWE-209 class to its whole-app boundary (A26); fix what it finds

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes unchanged.

## 2. Why this sweep (A26 — a class isn't fixed until swept to its codebase-wide boundary)
The xh audit fixed one raw-error-FIELD leak (`files/upload-url` → `target.error`) but scoped its clean claim
to the sign/upload surface. A26 says the class must be swept to its boundary. The class is distinct from the
prior CWE-209 sweeps (which grepped `.message`): here a `{ ok:false, error }` RESULT OBJECT carries a raw
backend string in its `.error` FIELD, and the route returns `{ error: result.error }` — invisible to a
`.message`-keyed grep AND to the standing invariant.

Sweep command run across all of `src/app/api`:
`grep -rnE "error:\s*[a-zA-Z_]+\.(error|detail)\b"` → then classify each hit by hand.

## 3. Classification (each hit read, not pattern-matched)
- CONTROLLED (leave): `auth.error` / `ctx.error` / `c.error` (curated auth-gate strings), `v.detail` (upload
  validation), `parsed.error.issues[].message` (Zod validation text), `refreshExtensionSession` returns (all
  three are curated: "Session could not be refreshed. Sign in again." etc.).
- **LEAK — `finance/forecast:36`**: `fc.error.message` where `fc = sb.rpc("fin_cash_forecast")` — a raw
  Postgres/RPC message returned to an authed user, AND mis-statused 403 (a query error is a 500).
- **LEAK — `care/agent/acms/documents:74,98`** via **`knowledgeDocs.ts:147,180`**: `addKnowledgeVersion` /
  `retractKnowledge` return `{ ok:false, error: error?.message ?? "…" }` — the `error?.message` fallback is the
  raw Supabase message, surfaced to the agent by the route. Fix at the SOURCE (the helper), which fixes both
  route call-sites at once (correct altitude).

## 4. The fix
Both leaks: log the raw cause server-side, return a generic message — the established CWE-209 remediation
(dozens of prior instances, `reference_public_api_raw_error_leak_and_sweep_recipe`). finance/forecast also
corrected 403 → 500. A route test locks the finance/forecast path; the knowledgeDocs helper now returns only
literal strings (grep-verified: no `.message` interpolation remains in the returned `.error`).

## 5. Record check (§1.2 — suspect, not automatically a fix)
Are these intentional domain surfaces (like the finance 400/403 domain errors, which ARE intentional)? No:
`fc.error.message` is a raw DB/RPC error (not a curated domain message like "period is closed"), and the
knowledgeDocs `error?.message` is an explicit raw-fallback. Both are un-updated instances of the class the app
guards, not deliberate surfaces.

## 6. Hypothesis (§1.5.2)
- **H1 — did the sweep find every raw-error-FIELD leak?** → The `.(error|detail)` grep across src/app/api
  returned a bounded, hand-classified set; the two raw-backend cases are fixed, the rest are controlled. The
  general invariant-widening to catch this field pattern is deferred (A33 false-positive risk) and named as a
  residual. CONFIRMED for the reachable route surface.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-11T18:05:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understanding precedes solving — classify each hit by reading it, not by pattern.", "how_this_build_will_embody_it": "Every grep hit was read + classified; only the two raw-backend cases were changed." },
  { "id": "§0.1", "read_at": "2026-08-11T18:05:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Governing-doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-11T18:06:00Z", "source_file": "CLAUDE.md", "line_range": "178-182", "why_it_governs": "Retrospective identification — check the record for whether each hit is an intentional surface before fixing.", "how_this_build_will_embody_it": "Section 5 distinguishes the raw-DB leaks from the intentional finance domain-error surface." },
  { "id": "§1.5.1", "read_at": "2026-08-11T18:06:15Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — fix at the right altitude so both call-sites are covered.", "how_this_build_will_embody_it": "Fixed knowledgeDocs at the SOURCE helper, covering both acms/documents routes." },
  { "id": "§1.5.2", "read_at": "2026-08-11T18:06:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit — sweep the class, don't stop at the one route that prompted it.", "how_this_build_will_embody_it": "Swept the whole src/app/api for the field pattern, not just the sign surface." },
  { "id": "§3.4", "read_at": "2026-08-11T18:06:45Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — a raw backend string to the client is a leak, not a helpful error.", "how_this_build_will_embody_it": "Both routes now return a generic honest message; the raw cause goes to the log." },
  { "id": "§6", "read_at": "2026-08-11T18:07:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The decision checklist forces record-check + holistic before acting.", "how_this_build_will_embody_it": "Section 5 checks the record; section 4 fixes at the source altitude." },
  { "id": "A16", "read_at": "2026-08-11T18:07:15Z", "source_file": "ThinkerThinker.md", "line_range": "40-52", "why_it_governs": "Apply-here-miss-there — the generic-error guard must hold across every sibling route.", "how_this_build_will_embody_it": "Extends the established CWE-209 posture to the two un-updated routes." },
  { "id": "A19", "read_at": "2026-08-11T18:05:45Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree this session.", "how_this_build_will_embody_it": "Read each route + the knowledgeDocs helper in-tree before changing them." },
  { "id": "A22", "read_at": "2026-08-11T18:07:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-11T18:07:45Z", "source_file": "ThinkerThinker.md", "line_range": "66-72", "why_it_governs": "A found bug is a CLASS — sweep it to the codebase boundary before 'fixed'.", "how_this_build_will_embody_it": "Completed the raw-error-FIELD sweep across all of src/app/api, not just the xh sign surface." },
  { "id": "A30", "read_at": "2026-08-11T18:08:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the class in a test.", "how_this_build_will_embody_it": "A finance/forecast test asserts generic-not-raw + 500; the knowledgeDocs return is grep-verified literal-only." },
  { "id": "A38", "read_at": "2026-08-11T18:08:15Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + its output.", "how_this_build_will_embody_it": "check.md pastes the vitest + npm run check runs with exit codes." }
]
```
