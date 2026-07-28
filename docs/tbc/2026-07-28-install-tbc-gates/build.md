# BUILD — TBC gate installation

Built the standing-build-protocol infrastructure per `THINK_BUILD_CHECK.md` §6 and
`BUILD-PROTOCOL.md`'s installation section, **without** the mandatory wire-in (that step is gated on
AMD-008 — see think.md §5). Every component below asserts both reachability directions
per A31: schema-complete is not built, so a script nothing invokes and nothing reads is
dead config, not a feature.

### TBC verifier scripts

- files: `scripts/tbc/lib.mjs`, `verify-docs.mjs`, `verify-manifest.mjs`, `verify-artifacts.mjs`, `verify-residual.mjs`
- write-path: exists — a developer or CI runs `node scripts/tbc/verify-<x>.mjs` today; on AMD-008 ratification they become `npm run tbc` inside the `check` chain and the pre-commit hook. Human can invoke: yes (demonstrated in Verification below).
- read-path: exists — the process exit code (0/1 via `lib.mjs::run`) gates the caller, and the `✗ [clause] message` lines are read by the developer. Human can see: yes.
- reachability status: **BUILT.** The gates ran against this directory and produced actionable output (below), so neither path is dead.

### Governing-doc manifest + allowlist

- files: `docs/tbc/DOC_MANIFEST.json`, `docs/tbc/ALLOWLIST.json`
- write-path: exists — `DOC_MANIFEST.json` was written from live `sha256sum` output this session; regenerated only under a ratified amendment (§7.4). `ALLOWLIST.json` is written per-exception with a ≥20-char reason.
- read-path: exists — `verify-docs.mjs` reads the manifest and fails on hash drift without a referenced AMD; `lib.mjs::loadAllowlist` reads the allowlist and rejects reasonless entries (A33 false-positive discipline).
- reachability status: **BUILT.** `tbc:docs` read the manifest and reported both documents match.

### Bootstrap build record

- files: `docs/tbc/2026-07-28-install-tbc-gates/{think,build,check,closure}.md`
- write-path: exists — authored by hand this session as the dogfood of the protocol.
- read-path: exists — `verify-manifest.mjs`, `verify-artifacts.mjs`, `verify-residual.mjs` read these files and fail on absence/inconsistency.
- reachability status: **BUILT.**

### AMD-008 proposal + residual queue

- files: `docs/amendments/AMD-008-PROPOSED-automatic-build-protocol.md`, `docs/residuals/OPEN.md`
- write-path: exists — the proposal is on the append-only amendment record; residuals are appended as a work queue (A36), not a disclaimer.
- read-path: exists — the founder reads AMD-008 for the outside-view check (§7.4 gate); the next build reads `OPEN.md` at its start; `verify-docs.mjs` accepts an AMD reference when a governing doc changes.
- reachability status: **BUILT** (proposal), **PENDING founder** (ratification).

## Verification (A38 — a command, not a mood)

The canonical command is `npm run check` (from `package.json`). Run by name, this session,
**after** all install files were added — its output and exit code, pasted:

```
> execos@0.1.0 check
> npm run typecheck && npm run lint && npm run theme:audit && npm run rls:audit && npm run invariant:audit && npm run test

> execos@0.1.0 typecheck
> tsc --noEmit
> execos@0.1.0 lint
> eslint . --ext .ts,.tsx
...
  Files scanned:        690
  Documented exceptions: 12
  Violations:           0
...
 Test Files  225 passed | 1 skipped (226)
      Tests  1602 passed | 15 skipped (1617)
   Duration  9.79s

EXIT=0
```

**Coverage: 6-of-6 gates (typecheck · lint · theme:audit · rls:audit · invariant:audit ·
test), exit 0.** This confirms H1: adding `scripts/tbc/*.mjs` and `docs/` artifacts did
not break the existing canonical command — because `lint`/`typecheck` are scoped to
`.ts/.tsx` and the audits scan `src/`, so the new `.mjs` files are outside their reach.
The word **green** here is anchored to that pasted output and its exit code, not asserted.

The four TBC gates themselves, run by name against this build directory this session
(`node scripts/tbc/verify-<x>.mjs`), are recorded in check.md with their exit codes —
the CHECK phase is where they are audited, not merely claimed. `not-run`: NONE. `untested`:
the pre-commit hook path (`.husky/pre-commit`) is UNTESTED because it is not installed —
its installation is part of the ratification-gated wire-in, deliberately out of scope here.
