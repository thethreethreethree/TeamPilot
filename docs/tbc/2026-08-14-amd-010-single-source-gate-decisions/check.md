# CHECK — AMD-010: single-source gate decisions

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md. The two drift-guards this build
must satisfy: Invariant 12 (constitution amendmentCount=8 / lastAmendmentId=AMD-010 match the ratified record)
and verify-docs (DOC_MANIFEST hashes match the edited governing docs).

## Findings
**No findings** (no new code-defect findings). This is a governance build: it ENCODES the remediation of an already-recorded and
already-fixed finding — the account-based empty-AI outage (root fix c7e719f6, its own TBC dir
2026-08-14-controlexempt-discarded-in-call). AMD-010 + CLAUDE.md §2.2 + ThinkerThinker.md A40 are the §A30 "encode
the class in a gate/asset so it cannot recur in prose only" step for that incident. The only code change is the
`src/lib/constitution.ts` registry values, validated behaviorally by Invariant 12.

## Class sweep (A26)
Confirmed the two registries that drift when the constitution changes are BOTH updated (Invariant 12 constant +
DOC_MANIFEST hashes) — the exact honesty-drift Invariant 12 was written to catch. No third registry references the
amendment count (grep `amendmentCount` / `lastAmendmentId` → constitution.ts + the invariant only).

## Verification
```
$ npm run check   → Invariant audit Violations: 0 (Invariant 12 passes with count 8 / AMD-010)
                   → tbc:docs: 2 governing documents match the manifest (new hashes)
```
Full gate + exit code in closure.md.
