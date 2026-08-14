# CLOSURE — AMD-010: single-source gate decisions

## What shipped
The founder's requested amendment against the account-based empty-AI outage. AMD-010 ratifies the rule
"a gate/authorization decision is returned as a verdict and consumed, never re-derived by a downstream consumer."
Encoded as CLAUDE.md §2.2 + ThinkerThinker.md A40, with the two enforcing registries synced (constitution.ts
Invariant-12 metadata; DOC_MANIFEST.json hashes).

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-amd-010-single-source-gate-decisions)
typecheck ✓ · lint ✓ · theme-leak audit ✓ · RLS audit ✓ · Invariant audit — Violations: 0 ✓ (Invariant 12: count 8 / AMD-010)
tbc:docs ✓ (2 governing docs match the regenerated manifest) · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
exit 0  (see the run pasted at commit time)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "AMD-010 mandates the verdict-return refactor (runBrainCall returns an explicit `suppressed` flag; consumers read it) but this commit ships only the amendment + the interim one-line mirror + regression test.", "why_skipped": "The refactor touches 6 re-check sites + the streaming routes; scoped as a separate change. The amendment is the governance encoding; the refactor is its full mechanical satisfaction.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T13:08:00Z", "outcome": "Flagged (AMD-010 body + controlexempt remediate.md R1)." },
  { "id": "R2", "item": "Clock-drift artifact: started_at 13:00Z ahead of the real clock to sort newest for the TBC dir-selector.", "why_skipped": "Ordering honest; absolute value tracks the session's drifted clock (reference_tbc_build_dir memory).", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T13:08:30Z", "outcome": "Noted." }
]
```

## Un-named reliance
Relies on Invariant 12 counting "ratified" by the `**Status:** ratified` line in each AMD file — AMD-010's status
line reads "ratified", so it counts (8 total). If that line's wording changed, the count would drift; the
invariant test (`invariant-audit.test.ts`) guards the parser.

## Status
Complete at gate exit 0. The gate-drift class is now on the record as CLAUDE.md §2.2 + A40, and the constitution
honestly reports version 1.10 / AMD-010.
