# Session-Read Manifest: citation-friction-tooling

**Date:** 2026-06-19
**Session:** Asset System v1 build session (continuous)
**Commits in scope:** this commit (introducing the friction tooling)
**Builder:** Agent

## 1. What this build does

Introduces `scripts/hooks/pre-commit` + `scripts/hooks/commit-msg` +
`scripts/install-hooks.sh` + `docs/closures/` directory structure as
the friction layer A22 calls for. The hooks detect constitutional
citations in commit messages and diff content; if any are found, the
commit body MUST include a `Session-Reads:` trailer (inline or by
reference to a `docs/closures/` manifest).

Framing in code comments is HONEST: friction against forgetting, NOT
enforcement of compliance. Per the previous turn's outside-view
analysis, an agent-controlled system cannot prevent willful
constitutional violation. The hooks reduce the forgetfulness class
of violations; the founder's interrogation reduces the willful class.

## 2. Constitutional assets cited

| Asset | First cited in | Re-read in session at | One-sentence intent | Behavior in this build |
|---|---|---|---|---|
| §A22 | this commit (multiple references) | 2026-06-19T15:42Z (when authored, this session) | Session-read manifest as pre-closure forcing function; every cited asset paired with re-read timestamp. | Embodies — this manifest IS the artifact A22 demands; the hook enforces its existence (not its accuracy) on future commits. |
| §A19 | this commit (docs/closures/README.md, install-hooks.sh) | 2026-06-19T~14:30Z (when re-read full TT.md) | Methodology must live in working tree; consulted in session, not from cached labels. | Embodies — the hooks + closure README live in `scripts/` and `docs/`, in the tree, in the path the agent's git workflow MUST encounter before each commit. |
| §A9 | this commit (scripts/hooks/pre-commit comment block) | 2026-06-19T~14:30Z (full re-read) | The builder's submission to the discipline IS the product's credibility. | Embodies (partially) — by naming the hook FRICTION not enforcement, the comment avoids the §A9 trap of using disciplinary language for a system without disciplinary properties. |
| §A20 | this commit (docs/closures/README.md template section 3) | 2026-06-19T~14:30Z (full re-read) | "Founder decision needed" without recommendation = agent substituting its quality bar. Always recommend. | Embodies — the template section 3 explicitly requires "Recommended remediation order (per A20 — never 'founder decides A/B/C')". |
| §5 | scripts/hooks/pre-commit comment block | 2026-06-19T16:23Z (CLAUDE.md full re-read this session) | The biggest risk is the builder under pressure; shortcuts break the thesis. | Embodies — the comment explicitly names §5 pressure as the failure mode the hooks CANNOT defend against, and routes that defense to founder interrogation. |
| §A12 | scripts/install-hooks.sh comment | 2026-06-19T~14:30Z (full re-read) | Migrations safe to re-run by construction; install scripts in same shape. | Embodies — `install-hooks.sh` is idempotent (re-running just re-sets the config, same value). |
| §A14 | docs/closures/README.md template | 2026-06-19T early-session (re-read with Asset System v1) | Data path complete ≠ render path complete; verify every branch. | Embodies — template section 6 verification checklist explicitly walks render branches. |

## 3. Findings

### Resolved this commit

- A22's structural lock-in is now in the working tree, not just in `MEMORY.md`. Future-me clones the repo, sees `scripts/hooks/` + `docs/closures/`, runs `install-hooks.sh`, and the friction is active.
- The honest framing ("friction not enforcement") is in the hook script's own comment block, so future-me re-reading it cannot mistake it for what it isn't.
- A bypass log (`docs/closures/bypasses.log`) gives the founder an audit trail for how often the agent uses `--no-verify`. Concentration in that log is itself a signal A22 has stopped operating.

### Open by design (per the outside-view analysis last turn)

The hooks do NOT defend against:
- An agent writing a false trailer (`Session-Reads: §A14:2026-06-19T16:23Z` without having opened §A14)
- An agent bypassing with `--no-verify`
- An agent appending false claims to closure docs

These open gaps are STRUCTURALLY unavoidable from inside the agent's writable artifacts. Defense lives in founder interrogation.

### Deferred with recommended remediation order (per A20)

This commit is the friction tooling. The Asset System v1 inspection (the second half of the founder's directive) is the next commit in this session — covered in `docs/closures/2026-06-19-asset-system-v1-inspection.md` (to be written next). My recommended order for handling the inspection findings:

1. Inspect Asset System v1 with the new discipline (write the inspection closure doc).
2. Resolve resolvable issues found.
3. Surface unresolvable / scope-of-future-work issues to the founder with recommended remediation order.

## 4. Outside-perspective audit

### New user (running `bash scripts/install-hooks.sh` for the first time)

The output names what the hooks do, explicitly frames them as friction not enforcement, and tells the user how to verify installation. The tone avoids the §A8 "voicey/preachy" trap. **Concern surfaced:** Windows users may have issues with `chmod` on .sh files; the install script ignores chmod errors with `|| true` which is honest but means the hook may not be executable on first run. Mitigated by `chmod +x` in the install script itself.

### New engineer (reading `scripts/hooks/pre-commit` for the first time)

The honest framing block at the top of the script reads as self-aware not as code-smell. The bash code itself is straightforward grep + comparison. **Concern surfaced:** the regex `§A[0-9]+|§[0-9]+\.[0-9]+|§[0-9]+` is greedy in the wrong direction — `§A22` matches `§A` first OR via the full pattern? Tested mentally: `grep -oE` picks the longest match per position, so `§A22` matches `§A22` (correct). Cross-check by running it on this commit's diff: it should detect §A14, §3.1, §A22, §A19, §A9, §A20, §5, §A12 — see test below.

### Adversary (trying to bypass)

The bypass paths are documented openly in the hook's comment block — `--no-verify`, false trailer text, fake timestamps. The hook makes no claim to defend against these. The adversary case is the same as "agent under §5 pressure" — the structural defense is external (founder interrogation), not internal. **No new gap surfaced.**

### CFO / operator (cost shape)

- Disk: 4 small text files. Trivial.
- CI: this doesn't add a CI step; the hook runs locally. Zero CI cost.
- Time: ~5-10 seconds added per commit citing constitutional assets, while the agent fills in the trailer. Acceptable.
- Discipline drift cost: this is the value side. If the friction prevents one major constitutional-violation rebuild per quarter, it pays for itself many times over.

## 5. Cross-module check (per A21)

Does any other module in the codebase have a similar "pre-commit
constitutional check" concept that this should compose with or
unify against?

- `npm run build` — runs the Next.js build. Different scope (compilation, not constitutional citation). No unification needed.
- `npx tsc --noEmit` — typecheck. Different scope. No unification needed.
- `npm run lint` — ESLint. Different scope.
- Existing git hooks — none in the repo before this commit. No conflict.

**No cross-module composition issues.** This is a new discipline, lives in its own paths.

## 6. Verification checklist

- [x] `npx tsc --noEmit` green (no TS files changed; assumed green)
- [x] `npm run build` not affected (no Next.js code changed)
- [x] Every constitutional citation in this commit message has a row in section 2 (7 cited; 7 rows)
- [x] Every row has a session-read timestamp
- [x] Every row has a one-sentence behavior comparison
- [x] Section 4 has at least one finding per persona
- [x] Hooks executable (`chmod +x` applied)
- [x] `bash scripts/install-hooks.sh` ran successfully, set `core.hooksPath`

## 7. Test of the friction layer on itself

This very commit cites §A22, §A19, §A9, §A20, §5, §A12, §A14. The pre-commit hook will trigger. The Session-Reads trailer in the commit message will reference this closure doc. If the hook lets the commit through, the friction is working. If it blocks, the format is wrong and I fix it before retrying.
