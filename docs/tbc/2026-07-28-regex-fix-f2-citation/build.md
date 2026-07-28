# BUILD — F2 citation-regex fix

One change, one file: `scripts/tbc/lib.mjs` — the `CITATION_RE` constant that
`extractCitations` (the single citation-detection chokepoint, A30) applies.

### F2 · CITATION_RE requires the section sign for the asset form

- files: `scripts/tbc/lib.mjs`
- change: removed the second alternation `(?<![A-Za-z0-9])(A\d{1,3})(?![A-Za-z0-9])`
  that matched a BARE `A<n>`. The regex is now `/§\s?(A\d{1,3}|\d+(?:\.\d+){0,2})\b/g`
  — the section sign is required for both the asset form (§A26) and the section form
  (§1.5.1, §6), matching `scripts/hooks/commit-msg` (A21/A28).
- write-path: exists — `CITATION_RE` is applied inside `extractCitations` in `lib.mjs`;
  `verify-manifest.mjs` invokes it over the build-dir artifacts and commit messages. The
  detection is reachable from the real gate path. Human sets it: the author writes prose;
  the gate reads it.
- read-path: exists — `verify-manifest.mjs` consumes `extractCitations`' output to decide
  which ids require a manifest entry, and emits the pass/fail the developer reads. The
  output is consumed, not dead.
- reachability status: **BUILT** and confirmed by the H1/H2 tests (see think.md hypotheses).

## Verification (A38)

The four gates re-run against the install bootstrap AFTER the change (regression check),
by name, with exit codes — the change did not regress the prior green build:

```
$ node scripts/tbc/verify-docs.mjs       → ✓ tbc:docs       [exit 0]
$ node scripts/tbc/verify-manifest.mjs   → ✓ tbc:manifest   [exit 0]
$ node scripts/tbc/verify-artifacts.mjs  → ✓ tbc:artifacts  [exit 0]
$ node scripts/tbc/verify-residual.mjs   → ✓ tbc:residual   [exit 0]
```

Behaviour confirmed by direct probe (think.md H1): `extractCitations("render to A4 paper")`
→ `[]`; `extractCitations("§A26 governs")` → `["A26"]`. The full canonical `npm run check`
(now with this change live) is pasted in closure.md's verification record with its exit code. `not-run`: NONE.
`untested`: NONE.
