# REMEDIATE — TBC install findings

### F1 · POSIX-separator assumption in gate labels — FIXED

- closes: check.md F1.
- clause: A26 (sweep the class, not the instance) + A30 (encode the fix at a chokepoint).
- what changed: added `repoRel(p)` to `scripts/tbc/lib.mjs` — a separator-agnostic,
  repo-relative path helper — and routed all four label sites through it:
  `verify-artifacts.mjs:33`, `verify-manifest.mjs:32`, `verify-manifest.mjs:170`,
  `verify-residual.mjs:25`. The A26 sweep (`grep -rnE 'split\("/"\)|REPO \+ "/"' scripts/tbc/`)
  returned exactly those four; all four are converted.
- what remains: nothing. `REPO` is still imported in `verify-manifest.mjs` (used at line
  105 for `join(REPO, e.source_file)`), so no dangling import there.
- untested: none — re-run below.
gate-or-promise: GATE (chokepoint form, A33). The separator invariant now holds *by
construction* in one function; every human-readable label is built through `repoRel`, so
  the class cannot recur label-by-label. A standing grep-gate for "raw `split('/')` on a
  native path" was considered and **declined per A33** — it would fire on the many correct
  POSIX splits elsewhere (noisy gate), and the chokepoint makes it unnecessary.

## Re-run (A38)

The four TBC gates, re-run by name against this directory after the fix — output and exit
codes recorded in closure.md's verification section (the single place the final clean run is
pasted, to keep one source of truth for the closing state).
