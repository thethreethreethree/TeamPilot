---
tbc_version: 1
trigger: fix
started_at: 2026-08-11T18:35:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 1
---

# THINK — Close the A30 gate for the nested raw-.message CWE-209 leak (xi left it un-gated)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes unchanged.

## 2. Why (A30 — a fix is not complete until the class is in a gate, or the gate is declined per A33)
Build xi fixed `finance/forecast` leaking `fc.error.message` (a raw RPC/Postgres error) and named the gate as
A33-DEFERRED: widening invariant 14 (CWE-209) risked false-positives. That deferral was TOO BROAD. It conflated
two widenings:
- **`error: X.error` (a non-`.message` FIELD)** — genuinely needs cross-file analysis (is `result.error` raw or
  curated?), so it stays A33-deferred. Correct.
- **`error: X.Y.message` (nested access ending in `.message`)** — the shape that leaked in finance/forecast — is
  NOT ambiguous: the terminal `.message` is the same strong raw-exception signal invariant 14 already keys on;
  it was simply reached one property hop deeper than the one-hop regex allowed. This CAN be gated with zero new
  noise. So this narrow form should be gated NOW, not deferred.

## 3. The change
Widen invariant 14's `RAW_ERR_MSG_RE` direct alternative from `X.message` to `X(.Y)?.message` — an OPTIONAL
intermediate property. Add a permanent detection-test (invariant 14 shipped with none) asserting: nested
(`fc.error.message`), direct (`err.message`), interpolated, and catch-fallback forms MATCH; controlled
(`auth.error`, `result.error`, Zod `parsed.error.issues[0]?.message`, string literals) do NOT; and the SCRIPT
retains the nested-access group so the widening can't be silently reverted.

## 4. Record check (§1.2) — is the current tree clean under the widened regex?
Yes — finance/forecast (the only nested site) was fixed in xi, and a whole-app grep for
`error: X.Y.message` returns nothing. So the widened gate is GREEN today and purely a regression guard.

## 5. Hypothesis (§1.5.2)
- **H1 — does the widened regex introduce false-positives?** → No. Detection-tested: the four controlled shapes
  do not match (they don't end in a plain-property `.message`), the invariant audit is 0 violations, and the
  existing `kind:`/`status 400-429` exclusions still apply. CONFIRMED.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-11T18:35:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understanding precedes solving — understand WHY the nested form slipped before widening.", "how_this_build_will_embody_it": "Traced the one-hop regex limitation to the finance/forecast leak before changing it." },
  { "id": "§0.1", "read_at": "2026-08-11T18:35:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Governing-doc hashes verified in-tree." },
  { "id": "§1.5.1", "read_at": "2026-08-11T18:36:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — a gate change must not break the surrounding invariant suite.", "how_this_build_will_embody_it": "Ran the full invariant audit (0 violations) + the detection tests after widening." },
  { "id": "§1.5.2", "read_at": "2026-08-11T18:36:15Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive — split the deferred gate into the part that's feasible now and the part that isn't.", "how_this_build_will_embody_it": "Gated the narrow nested form now; kept the ambiguous field-widening A33-deferred." },
  { "id": "§1.2", "read_at": "2026-08-11T18:36:20Z", "source_file": "CLAUDE.md", "line_range": "178-182", "why_it_governs": "Retrospective identification — check the record (is the tree clean under the widened regex?) before shipping the gate.", "how_this_build_will_embody_it": "Section 4 confirms finance/forecast (the only nested site) was already fixed, so the widened gate is green today." },
  { "id": "§6", "read_at": "2026-08-11T18:36:45Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The decision checklist forces holistic + record-check before acting.", "how_this_build_will_embody_it": "Section 4 confirms the tree is clean under the widened regex before shipping it." },
  { "id": "A19", "read_at": "2026-08-11T18:35:45Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree this session.", "how_this_build_will_embody_it": "Read invariant 14 + its test harness in-tree before extending them." },
  { "id": "A22", "read_at": "2026-08-11T18:37:00Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-11T18:37:15Z", "source_file": "ThinkerThinker.md", "line_range": "66-72", "why_it_governs": "A found bug is a class — encode the boundary so the class can't recur.", "how_this_build_will_embody_it": "The widened regex + detection-test lock the nested-.message form of the class." },
  { "id": "A30", "read_at": "2026-08-11T18:37:30Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "A fix is complete only when the class is in a gate that fails without the author — or the gate is declined per A33.", "how_this_build_will_embody_it": "Closes the gate xi left A33-deferred for the narrow, feasible half; the ambiguous half stays declined." },
  { "id": "A38", "read_at": "2026-08-11T18:37:45Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + its output.", "how_this_build_will_embody_it": "check.md pastes the invariant-audit + vitest runs with exit codes." }
]
```
