# BUILD — AMD-010: single-source gate decisions

### The amendment record
read-path: `docs/amendments/AMD-010-single-source-gate-decisions.md` — append-only (§7.3), ratified by founder
directive 2026-08-14, structured through the six §7.2 soundness checks (trigger = the account-based empty-AI
outage; structural-gap fill — no prior rule against re-deriving an authority's decision).
write-path: new file in `docs/amendments/`; Invariant 12 counts it as the 8th ratified amendment (its
`**Status:** ratified` line), driving the constitution.ts bump.

### CLAUDE.md §2.2
read-path: `CLAUDE.md` is the governing document the agent (and verify-docs) reads; §2.2 becomes a standing
build rule consulted on every gated-feature build.
write-path: new subsection "Single-source decisions — consume the verdict, don't re-derive the gate" after §2.1,
referencing AMD-010. States the rule (authority returns a verdict; consumers branch on it; unavoidable
re-derivation mirrors term-for-term + a both-branches drift-guard test), with the outage as the worked example.

### ThinkerThinker.md A40
read-path: the agent reads `ThinkerThinker.md` per §0.1 before any substantive build; A40's future-use questions
are the lens a future gated-feature build consults.
write-path: new asset entry (Context / Insight / Constitutional bearing / Future-use note) + TOC line + header
"A1–A40". The operational how-to: the four audit questions, the code smells, and the "empty-but-billed" tell.

### Registry sync (drift-guards that MUST move with the constitution)
read-path: Invariant 12 (`scripts/invariant-audit.mjs`) reads `src/lib/constitution.ts` + counts ratified
`docs/amendments/AMD-*.md`; `verify-docs.mjs` reads `docs/tbc/DOC_MANIFEST.json` + hashes the governing docs.
write-path: `src/lib/constitution.ts` — amendmentCount 7→8, lastAmendmentId AMD-008→AMD-010, version 1.8→1.10,
date/title (Invariant 12). `docs/tbc/DOC_MANIFEST.json` — regenerated sha256 for CLAUDE.md + ThinkerThinker.md
(verify-docs §7.4).

## Test coverage
The class's interim code-level guard is `src/lib/__tests__/claude.controlExempt.test.ts` (shipped in c7e719f6):
exempt-passes / non-exempt-suppresses / guidance-on-works. The registry drift-guards (Invariant 12, verify-docs)
are exercised by `npm run check` — they FAIL if the manifest hashes or the amendment count are stale.

## Notes
- Governance change: no new runtime code surface beyond the constitution constant (a registry value). No new
  code-defect findings; the "finding" is the already-fixed outage this amendment encodes against recurrence.
- §7.4 respected: the CLAUDE.md edit is the consequence of ratified AMD-010 and the commit references it.
