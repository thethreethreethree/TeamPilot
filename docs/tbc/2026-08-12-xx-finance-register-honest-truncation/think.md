---
tbc_version: 1
trigger: fix
started_at: 2026-08-12T14:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 2
---

# THINK — make the finance bank register's truncation HONEST (the last silent false-limit)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (the last false-limit site — a DISPLAY truncation, so the honest DEFAULT is disclosure)
`finance/bank/accounts/[id]/transactions` reads `fin_bank_transactions` ordered by txn_date desc with a fixed
2000-row cap → PostgREST returns ≤1000, so a busy account's register silently shows only the most recent ~1000
lines and hides the rest with NO indication. That is the honesty-thesis failure (§3.4): a user sees an incomplete
register believing it is complete. Unlike the aggregation false-limits (which get paged), this is a DISPLAY read —
full pagination is a UX decision (load-more vs infinite scroll vs date filter) that is genuinely the founder's.
But the honest DEFAULT — the pattern the codebase ALREADY uses (assetReadout's `bounded`, team-analytics'
`capped`) — is to DISCLOSE the cap. Disclosure is the conventional honest default (no UX fork), so it is
buildable now; the load-older UI stays the founder-gated enhancement (offered in the queue).

## 3. The fix (honest cap + disclosure, no data change)
- Cap explicitly at PAGE_MAX = 1000 (PostgREST's max_rows — the honest single-page max, matching FILE_SCAN_CAP),
  replacing the false `.limit(2000)` that returned the same ≤1000 while looking bounded. Returned rows unchanged.
- When the page is full (rows ≥ PAGE_MAX), a `count: exact, head: true` gives the true total (head counts are NOT
  row-capped, and it is skipped in the common under-cap case to avoid the extra query). Return
  `{ transactions, total, truncated }`.
- The register UI shows an amber disclosure — "Showing the most recent 1,000 of N transactions — older lines
  aren't listed here yet." — only when truncated.
- Removing the >1000 bound makes the finance FALSE_LIMIT_ALLOWLIST entry stale (the xu self-cleaning check flags
  it), so it is removed — leaving care.ts (the c5fbd454 KEEP/REVERT) as the SOLE remaining false-limit exception.

## 4. Boundary (§1.5.1 / A26)
This DISCLOSES the truncation; it does not add load-older paging (the founder-gated UX enhancement). The head
count is RLS-scoped via the same user client, so it is tenant-safe. No write/schema/calc change — the amounts and
rows shown are identical; only the honest-cap + notice are added.

## 5. Hypotheses (§1.5.2)
- **H1 — does the row set shown change?** No: `.limit(2000)` and `.limit(1000)` both return ≤1000 rows ordered
  txn_date desc — byte-identical returned data. Only `total`/`truncated` + the notice are new. CONFIRMED by
  reading the read.
- **H2 — is the head count correct + tenant-safe?** Yes: `count: exact, head: true` on the same RLS user client,
  scoped by `bank_account_id` (RLS scopes by company), gives the true total without row-capping; only run when the
  page is full. CONFIRMED by reading the route + the RLS-audit (finance routes RLS-scoped, invariant Violations 0).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T14:30:20Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand the register read→render path before changing it, so the disclosure reflects the real cap and the rows shown don't change.", "how_this_build_will_embody_it": "Section 3 keeps the returned rows identical; only total/truncated + a notice are added." },
  { "id": "§0.1", "read_at": "2026-08-12T14:30:20Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-12T14:30:40Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "This site was surfaced + tracked ('fix the false limits'); the disclosure default was already recorded as the stopgap option in the queue.", "how_this_build_will_embody_it": "Section 2 builds the option I logged; mirrors assetReadout's existing disclosed-cap pattern." },
  { "id": "§1.5.1", "read_at": "2026-08-12T14:31:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the read change ripples into the allowlist (re-sync) and the UI (disclosure), and must not change the data shown.", "how_this_build_will_embody_it": "Section 3 re-syncs the allowlist + wires the UI; H1 confirms the data is unchanged." },
  { "id": "§1.5.2", "read_at": "2026-08-12T14:31:10Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Honest boundary — disclose (the conventional default) now; do NOT build the load-older UX unprompted (a real founder decision).", "how_this_build_will_embody_it": "Section 4 draws the line: disclosure shipped, pagination stays founder-gated." },
  { "id": "§3.4", "read_at": "2026-08-12T14:31:15Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "The core rule here: a silently-truncated register is a lie of omission; the fix makes the incompleteness visible.", "how_this_build_will_embody_it": "The disclosure notice + total surface the hidden history instead of hiding it (the assetReadout `bounded` pattern)." },
  { "id": "§6", "read_at": "2026-08-12T14:31:20Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The checklist forces confirming the data-shown is unchanged + the allowlist ripple before shipping to a live finance surface.", "how_this_build_will_embody_it": "Sections 3-5 + the invariant/RLS audits at Violations 0." },
  { "id": "A16", "read_at": "2026-08-12T14:30:50Z", "source_file": "ThinkerThinker.md", "line_range": "381-390", "why_it_governs": "Reuse the codebase's existing disclosed-cap pattern rather than invent one.", "how_this_build_will_embody_it": "Mirrors assetReadout's bounded / team-analytics capped disclosure." },
  { "id": "A19", "read_at": "2026-08-12T14:30:55Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the route + its UI consumer in-tree before changing the contract, so the new fields wire correctly.", "how_this_build_will_embody_it": "Read the route + banking/page.tsx loadTxns/render in-tree before adding total/truncated." },
  { "id": "A22", "read_at": "2026-08-12T14:31:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads." },
  { "id": "A30", "read_at": "2026-08-12T14:31:40Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the lesson — honestly: the register route + page have no unit test in this repo.", "how_this_build_will_embody_it": "HONEST LIMIT: no test exists for this route/page (React page + a thin RLS read); the head-count/disclosure logic is simple + typecheck-covered, and the FALSE_LIMIT invariant + its self-cleaning check confirm the false bound is gone. No test claimed that was not written." },
  { "id": "A38", "read_at": "2026-08-12T14:31:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
