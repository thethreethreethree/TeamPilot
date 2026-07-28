# CHECK — audit of the TBC install

Audited the **built files**, not the intent. Where a claim rests on file content it cites
path and line.

## Within-module pass (§1.5.1, four layers)

- **1 · structure:** the five scripts share one `lib.mjs`, live under `scripts/tbc/`, and
  mirror the existing `scripts/*-audit.mjs` convention (node script, `✓`/`✗` line, exit
  code). Defensible.
- **2 · effectivity:** invoked as a real caller would (`node scripts/tbc/verify-<x>.mjs`),
  the gates produced correct verdicts — `tbc:docs` and `tbc:residual` exit 0; `tbc:manifest`
  correctly failed on two stray section-reference tokens in my own draft before rewording.
  The gate detected a real defect in my own artifact. That is the effectivity proof.
- **3 · composition:** the install does not modify the `check` chain or the commit flow, so
  the committer's current workflow is untouched until AMD-008 ratification. No stall.
- **4 · surface:** terminal output matches the repo's other audits — except Finding F1.

## Cross-module pass (§1.5.1, A21)

Feature-concept inventory — which concepts here exist under the same name elsewhere?

- **"audit script that exits non-zero on violation"** — exists as `scripts/theme-audit.mjs`,
  `rls-audit.mjs`, `invariant-audit.mjs`. Parity confirmed: the tbc gates use the identical
  `node <script> → exit 0/1` contract and are wired the same way (`npm run <name>`). No
  same-name-different-philosophy conflict (the A21 failure class).
- **"allowlist of documented exceptions"** — `invariant-audit.mjs` carries 12 documented
  exceptions; `tbc` uses `ALLOWLIST.json` requiring a ≥20-char reason. Same philosophy
  (an exception must carry its reason), consistent implementation. No conflict.

## Findings

### F1 · TBC gate failure messages render a malformed path label on Windows

- evidence: `tbc:manifest` printed `cited in: docs/tbc/C:\Users\...\2026-07-28-install-tbc-gates/think.md`. Source: `scripts/tbc/verify-manifest.mjs:170` builds the label with `dir.split("/").pop()`, and `verify-artifacts.mjs:33` uses `dir.replace(REPO + "/", "")`. `currentBuildDir()` returns a native path (backslashes on Windows), so the POSIX `"/"` split/replace does not fire and the whole absolute path leaks into the label.
class: POSIX-separator assumption in tooling — string operations that assume `"/"` applied to a native filesystem path.
sweep: `grep -rnE 'split\("/"\)|REPO \+ "/"' scripts/tbc/` — boundary is the five tbc scripts (the only new tooling this build added); it returned exactly four sites.
severity: LOW — display-only. The verdicts and exit codes are correct; only the human-readable file label in a failure message is affected. On a POSIX CI runner the label renders correctly, so this never reaches the gate's actual job.

## Gate-the-lesson

F1's gate-or-promise disposition is recorded in remediate.md (that is where the fix and its
recurrence-prevention are decided).

## Inspected / not-inspected (§1.7 — a clean layer states what it read)

- **Inspected:** all five `scripts/tbc/*.mjs`; `DOC_MANIFEST.json`; `ALLOWLIST.json`; the
  four artifacts in this directory; the `package.json` `check` chain; the `origin/main..HEAD`
  commit range (empty, so no stray commit-message citations).
- **NOT inspected (→ residual):** the `.husky/pre-commit` hook behavior (not installed);
  the gates against a *second, real* build directory (tested against this one only); the CI
  runner's path behavior (assumed POSIX — F1 is why that assumption is now on the record).
