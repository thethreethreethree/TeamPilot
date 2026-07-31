---
tbc_version: 1
trigger: fix
started_at: 2026-07-31T12:15:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — verify:live H3 balance must assert the balance TRIGGERS are wired (+ correcting a premature "class complete")

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json.

## 2. Why — and an honest correction (§5)

The previous build's closure claimed the fn-checked-not-trigger class was COMPLETE, on the basis that
`fin_assert_entry_balanced` "has no trigger, is explicit-call". That conclusion was WRONG, and it was
wrong for the §0 reason the constitution warns about: I matched on ONE function name and stopped. When I
actually enumerated the guarantee-enforcing triggers on the journal tables, balance IS trigger-enforced —
by two DEFERRABLE CONSTRAINT triggers with DIFFERENT function names than the one H3 checks:

- `fin_assert_balanced_trg` on `fin_journal_lines` → `fin_assert_balanced` (raises).
- `fin_assert_balanced_entry_trg` on `fin_journal_entries` → `fin_assert_balanced_from_entry`, which calls
  the `fin_assert_entry_balanced` that H3 does check.

So H3 has the SAME gap as §3.2 and H2: it asserts the balance CHECKER function exists + raises, but not
that the triggers that INVOKE it at commit are wired. A dropped `fin_assert_balanced_trg` would let an
UNBALANCED entry post — double-entry integrity gone, the single most important finance guarantee — while
H3 stayed green.

## 3. Design (grounded, §0)

Verified live: both balance triggers are `AFTER INSERT … DEFERRABLE INITIALLY DEFERRED` constraint
triggers (the correct design — balance can only be judged once all lines exist, so it defers to commit).
Extend H3 to AND in two trigger-wired assertions: each balance trigger fn is wired on its journal table,
firing on INSERT (tgtype bit 4). Keep the existing `fin_assert_entry_balanced` fn-raises check (it is the
core checker the entry trigger calls).

## 4. Scope discipline (what I did NOT do)

Enumerating ALL guarantee-enforcing triggers surfaced DOZENS (care/chat immutability, `fin_freeze_creator`
across ~15 tables, approval-limit + expense-policy triggers, …). `verify:live` intentionally guards only a
SELECTIVE few thesis/money-critical invariants — it is not exhaustive by design. Expanding it to guard all
those is a founder scope decision, not an autonomous one. This build only fixes the trigger-wiring of the
balance check verify:live ALREADY has — which genuinely completes the class for its existing checks
(§3.2 gate, H2 immutability, H3 balance — all three now assert wiring).

## 5. Hypothesis

- **H1:** Both balance trigger-wired queries return 1 live (H3 keeps passing), and 0 if a fn/table/INSERT
  bit is wrong (H3 would FAIL on a dropped balance trigger). Detection-tested before shipping.

## 6. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-31T12:15:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding must be EARNED — my prior 'class complete' was the §0 failure (a fast match on one fn name that sounded right); this build enumerates the actual triggers before concluding.", "how_this_build_will_embody_it": "Section 2 owns the error; section 3 is grounded in the enumerated live triggers." },
  { "id": "§0.1",   "read_at": "2026-07-31T12:15:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH; this-session read_at." },
  { "id": "§1.5.1", "read_at": "2026-07-31T12:15:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Four layers — a guard that verifies a checker fn but not the trigger that invokes it reports false health at the foundation.", "how_this_build_will_embody_it": "H3 now verifies the balance enforcement is WIRED." },
  { "id": "§1.5.2", "read_at": "2026-07-31T12:15:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK then search — I enumerated ALL guarantee-enforcing triggers to avoid a THIRD premature closure, rather than guessing again.", "how_this_build_will_embody_it": "Section 4 scopes the fix from the full trigger census." },
  { "id": "§3.1",   "read_at": "2026-07-31T12:15:00Z", "source_file": "CLAUDE.md", "line_range": "255-266", "why_it_governs": "Correct/immutable financial data — an unbalanced posted entry is corrupt ledger data; the balance trigger is what makes double-entry true.", "how_this_build_will_embody_it": "The check asserts the balance triggers block an unbalanced INSERT at commit." },
  { "id": "§5",     "read_at": "2026-07-31T12:15:00Z", "source_file": "CLAUDE.md", "line_range": "334-346", "why_it_governs": "Distrust the confident answer that arrived too quickly — my 'class complete' was exactly that; the correction is the discipline defending the method.", "how_this_build_will_embody_it": "This build exists BECAUSE I re-checked a confident prior claim and found it false." },
  { "id": "A19",    "read_at": "2026-07-31T12:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across all entries." },
  { "id": "A22",    "read_at": "2026-07-31T12:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "This manifest + the commit's inline Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-07-31T12:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "91-93", "why_it_governs": "A fix is not complete until the class is gated — this is the honest completion of the class the last two builds started (now for real, verified against the trigger census).", "how_this_build_will_embody_it": "H3 fails the build if a balance trigger is dropped; detection-tested." },
  { "id": "A38",    "read_at": "2026-07-31T12:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run — the detection test + verify:live output are pasted.", "how_this_build_will_embody_it": "check.md pastes the verify:live 18/18 + detection-test output + exit." }
]
```
