---
tbc_version: 1
trigger: fix
started_at: 2026-07-31T12:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — verify:live H2 finance immutability must assert the triggers are WIRED

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json.

## 2. Why (the same blind-spot class, now on the money-integrity guard)

The prior build (2026-07-31-verify-live-gate-trigger-wired) fixed the §3.2 check to assert its trigger
is wired, and its residual named the identical gap in the H2 finance-immutability check: it asserts
`fin_entries_immutable` + `fin_lines_immutable` FUNCTIONS exist, but not that their TRIGGERS are attached.

This one is arguably more consequential than the §3.2 case: finance immutability is the money-integrity
guarantee (a posted journal entry/line can never be silently altered — the foundation of a trustworthy
ledger, §3.1's "immutable data" applied to money). A migration that dropped `fin_entries_immutable_trg`
or `fin_lines_immutable_trg` (or narrowed it away from UPDATE/DELETE) would let a posted entry be mutated
or deleted, while `verify:live` still reported H2 healthy from the fn-exists check alone.

## 3. Design (grounded in the live triggers, §0)

Verified live before editing: `fin_entries_immutable` is wired as `fin_entries_immutable_trg` on
`fin_journal_entries` (BEFORE INSERT OR DELETE OR UPDATE), and `fin_lines_immutable` as
`fin_lines_immutable_trg` on `fin_journal_lines` (same). `fin_assert_entry_balanced` has NO trigger — it
is an explicit-call function invoked by the post RPC, so H3's fn-exists+raises check is the correct level
for it (nothing to wire). So only H2 needs the fix.

Extend H2 to AND in two trigger-wired assertions: each immutability fn must run as a BEFORE UPDATE+DELETE
trigger on its table (tgtype bits 2=BEFORE, 8=DELETE, 16=UPDATE — the mutation-blocking events).

## 4. Hypothesis

- **H1:** Both trigger-wired queries return 1 live (the triggers ARE wired → H2 keeps passing), and return
  0 if a required event bit is absent or the fn/table is wrong (→ H2 would FAIL on a dropped/narrowed
  immutability trigger). Detection-tested before shipping.

## 5. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-31T12:00:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding first — I read the live finance trigger definitions (fin_entries/lines_immutable_trg) + confirmed fin_assert_entry_balanced is NOT a trigger before deciding what to assert, rather than guessing.", "how_this_build_will_embody_it": "Section 3 is grounded in the live catalog; only H2 (trigger-enforced) is extended, H3 (explicit-call) is left correct." },
  { "id": "§0.1",   "read_at": "2026-07-31T12:00:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH; this-session read_at." },
  { "id": "§1.5.1", "read_at": "2026-07-31T12:00:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Four layers — a guard that verifies a fn but not its wiring reports false health at the foundation (layer 1).", "how_this_build_will_embody_it": "The check now verifies the immutability enforcement is WIRED." },
  { "id": "§1.5.2", "read_at": "2026-07-31T12:00:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK then search — I carried the §3.2 finding forward as a hypothesis to the finance guard, then read the live triggers to confirm the same gap.", "how_this_build_will_embody_it": "Section 2 records the class; the fix is the confirmed parallel." },
  { "id": "§3.1",   "read_at": "2026-07-31T12:00:00Z", "source_file": "CLAUDE.md", "line_range": "255-266", "why_it_governs": "Immutable data — finance immutability is §3.1 applied to money; a posted entry that can be silently altered breaks the trustworthy-ledger foundation.", "how_this_build_will_embody_it": "The check asserts the immutability triggers block UPDATE+DELETE on posted entries/lines." },
  { "id": "§6",     "read_at": "2026-07-31T12:00:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — traced the blast radius (a read-only guard that only fails-more) + the why (money-integrity wiring).", "how_this_build_will_embody_it": "closure states the effect; the change only tightens." },
  { "id": "A19",    "read_at": "2026-07-31T12:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across all entries." },
  { "id": "A22",    "read_at": "2026-07-31T12:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "This manifest + the commit's inline Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-07-31T12:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "91-93", "why_it_governs": "A fix is not complete until the class is gated — this closes the finance half of the fn-checked-not-trigger class the §3.2 build opened.", "how_this_build_will_embody_it": "H2 now fails the build if an immutability trigger is dropped/narrowed; detection-tested." },
  { "id": "A38",    "read_at": "2026-07-31T12:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run — the detection test + verify:live output are pasted.", "how_this_build_will_embody_it": "check.md pastes the verify:live 18/18 + detection-test output + exit." }
]
```
