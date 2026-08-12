---
tbc_version: 1
trigger: fix
started_at: 2026-08-13T11:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 1
---

# THINK — the TBC gate must validate the NEWEST build, not the lexicographically-last name

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (a gate blind spot that shipped an unvalidated record, found this session)
`currentBuildDir()` selected the build to validate by `readdirSync(...).sort()` → last, i.e. the
lexicographically-LAST NAME. So a newer build whose name sorts EARLIER on the same day is silently skipped: this
session created `2026-08-13-display-honesty` (started 10:00) AFTER `2026-08-13-forced-client-update` (started
09:30), but "display-honesty" < "forced-client-update", so the gate kept validating forced-client-update and the
display-honesty record was COMMITTED UNVALIDATED — it had real gaps (missing A22, mis-formatted severity, a
missing write-path) that only surfaced when re-run via `TBC_BUILD=`. A verification gate that silently validates
the WRONG artifact is worse than no gate for that artifact. This is the recorded `tbc_build_dir_lexicographic_sort`
hazard, now with a concrete miss.

## 3. The fix (order by real build time, not name)
`currentBuildDir()` now keys each dir on its think.md `started_at` (an ISO instant) and returns the
most-recently-started build. The selection logic is extracted PURE as `pickLatestBuildName(entries)` and unit-
tested (5 cases incl. the exact regression + the malformed-dir fallback), because a bug here mis-validates every
build. A dir without a parseable `started_at` keys on its name and can only win if NO dir has one (the "1:" prefix
makes any timestamp beat a bare name), so a malformed dir can't hijack the selection from a real build.

## 4. Boundary (§1.5.1 / A26)
Only the SELECTION changes; every downstream check (manifest/artifacts/residual/freshness) is unchanged — they now
just receive the correct (newest) dir. `TBC_BUILD=` override is unchanged. All current dirs have a `started_at`
(verified), so the sort is well-defined. Naming discipline (same-day dirs sorted by name) is no longer load-bearing.

## 5. Hypothesis (§1.5.2)
- **H1 — does it pick the newest build regardless of name?** Yes — verified live: `currentBuildDir()` now returns
  `2026-08-13-display-honesty` (started 10:00), not the lexicographic-last `forced-client-update` (09:30). CONFIRMED
  by the node probe + the `pickLatestBuildName` regression test (name-sorts-earlier-but-newer → wins).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-13T11:00:20Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand how the gate selects the artifact it validates before changing that selection.", "how_this_build_will_embody_it": "Section 2 diagnoses the exact readdirSync().sort() selection + the concrete miss." },
  { "id": "§0.1", "read_at": "2026-08-13T11:00:20Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-13T11:00:40Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective — the miss is a documented incident this session (display-honesty committed unvalidated), and a recorded hazard; the fix is built from that record.", "how_this_build_will_embody_it": "Section 2 cites the concrete miss + the tbc_build_dir_lexicographic_sort record." },
  { "id": "§1.5.1", "read_at": "2026-08-13T11:00:55Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — currentBuildDir feeds every tbc verifier, so the change must keep them all correct and not regress the malformed-dir / override paths.", "how_this_build_will_embody_it": "Section 4 confirms downstream checks + TBC_BUILD override unchanged; the fallback protects against malformed dirs." },
  { "id": "§1.5.2", "read_at": "2026-08-13T11:01:05Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Guard-integrity strengthening (verifiable, can't produce a false finding) is the right kind of work here.", "how_this_build_will_embody_it": "A tooling-integrity fix locked by a pure unit test, not a bug-hunt." },
  { "id": "§5", "read_at": "2026-08-13T11:01:10Z", "source_file": "CLAUDE.md", "line_range": "300-345", "why_it_governs": "Under the build guard, prefer verifiable guard/test-strengthening that CAN'T produce a false finding — a gate-integrity fix is exactly that.", "how_this_build_will_embody_it": "Fixes the gate's own blind spot + locks it with a pure test; no product/behaviour risk." },
  { "id": "§6", "read_at": "2026-08-13T11:01:15Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — confirm the new selection is correct + detection-tested before trusting the gate again.", "how_this_build_will_embody_it": "H1 + the live probe + the 5 pickLatestBuildName tests." },
  { "id": "A19", "read_at": "2026-08-13T11:00:50Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the gate source (lib.mjs currentBuildDir + frontMatter) in-tree before changing it.", "how_this_build_will_embody_it": "Read currentBuildDir + frontMatter + confirmed all dirs carry started_at before editing." },
  { "id": "A22", "read_at": "2026-08-13T11:01:25Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads; minimum set present." },
  { "id": "A30", "read_at": "2026-08-13T11:01:35Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the lesson — the selection logic that mis-validated must now fail a test on regression, not a client.", "how_this_build_will_embody_it": "pickLatestBuildName extracted + 5 unit tests incl. the exact name-sorts-earlier-but-newer regression." },
  { "id": "A38", "read_at": "2026-08-13T11:01:45Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
