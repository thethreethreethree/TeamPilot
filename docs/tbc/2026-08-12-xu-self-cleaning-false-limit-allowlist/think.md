---
tbc_version: 1
trigger: fix
started_at: 2026-08-12T13:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — make the FALSE_LIMIT allowlist self-cleaning (prevent the xt drift from recurring)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (close the loop on a drift I demonstrably just caused — §1.2 retrospective)
Build xt fixed a STALE FALSE_LIMIT_ALLOWLIST entry: build xr replaced care/agent/analytics's `.limit(5000)` with
`fetchAllPaged` but left its allowlist entry, silently blinding INVARIANT 21 for that route. That drift was caught
only by a MANUAL re-audit. The lesson (the Close-the-Loop step of the Core Method): a resolution must become a structural asset so
the SAME mistake self-reports next time. This is not a hypothetical — I made this exact error this session, so the
evidence bar (§1.5.2: a finding I have evidence for, not "things tools usually get wrong") is met by the record.

## 3. The change (a self-cleaning check + its detection self-tests)
Add, right after INVARIANT 21's main loop, a check that every FALSE_LIMIT_ALLOWLIST entry still corresponds to a
LIVE `.limit(N>1000)` in its file; if not, flag it as STALE (remove it). Plus 4 `st()` self-tests in the existing
SELF-TEST block: the `hasLiveFalseLimit` matcher both directions, `.limit(300)` as no-bound, and a standing
assertion that EVERY current allowlist entry is still live (so a future stale entry fails the audit's own
self-test, not just its findings). No product/runtime change — CI-guard hygiene only.

## 4. Ripple + boundary (§1.5.1)
Scoped to the FALSE_LIMIT allowlist — the one where the drift occurred. The other ~15 allowlists suppress
different patterns (each needs its own logic), so a generic "every allowlist entry is live" check is out of scope
(A26 honest boundary: this build hardens ONE allowlist, not all). The self-check inherits the main check's
raw-text-scan property (a literal `.limit(NNNN)` in a comment reads as "live") — documented, same convention.

## 5. Hypothesis (§1.5.2)
- **H1 — does the self-check stay green now and fire on a stale entry?** Green now (all 5 current entries have a
  live limit — verified). Detection-tested: a probe entry for a no-false-limit file (the list route, `.limit(300)`)
  makes the audit fail (self-test exit 3 + a stale-entry finding); reverted → green. CONFIRMED both directions.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T13:00:20Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand INVARIANT 21's structure (allowlist continue + raw-text scan) before extending it, so the new check doesn't false-positive or duplicate.", "how_this_build_will_embody_it": "Section 3 places the check against the existing loop's exact semantics." },
  { "id": "§0.1", "read_at": "2026-08-12T13:00:20Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-12T13:00:40Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — the drift is a documented incident this session (xr→xt), which is why building the guard is evidence-backed, not speculative.", "how_this_build_will_embody_it": "Section 2 grounds the change in the xt record; the guard makes that incident self-reporting." },
  { "id": "§1.5.1", "read_at": "2026-08-12T13:00:55Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic + honest boundary — hardening one allowlist must not pretend to harden all; the ripple is scoped and stated.", "how_this_build_will_embody_it": "Section 4 draws the boundary: FALSE_LIMIT only, the other allowlists explicitly out of scope." },
  { "id": "§1.5.2", "read_at": "2026-08-12T13:01:05Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "The evidence bar — surface/build only what there is real evidence for; a mistake I made this session clears it.", "how_this_build_will_embody_it": "Section 2 cites the concrete xt incident as the evidence; no speculative guards added." },
  { "id": "§6", "read_at": "2026-08-12T13:01:15Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The checklist forces me to confirm the new guard is detection-tested (it can fail) before trusting its green, not merely added.", "how_this_build_will_embody_it": "Section 5 + closure run the two-direction detection test." },
  { "id": "A19", "read_at": "2026-08-12T13:00:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the guard source in-tree before extending it.", "how_this_build_will_embody_it": "Read INVARIANT 21 + the SELF-TEST st() block in-tree; mirrored the st() pattern." },
  { "id": "A22", "read_at": "2026-08-12T13:01:25Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads." },
  { "id": "A30", "read_at": "2026-08-12T13:01:35Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "A30 is the whole point — a guard that can't detect its own violation is worse than none; the new check must be proven to fire.", "how_this_build_will_embody_it": "4 st() self-tests + a live probe (exit 3 on a stale entry), reverted to green — see closure." },
  { "id": "A38", "read_at": "2026-08-12T13:01:45Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the invariant:audit + full-gate output with exit codes." }
]
```
