# BUILD — gate hardening (F3 + F4)

Files: `scripts/tbc/verify-freshness.mjs` (new), `scripts/tbc/verify-artifacts.mjs` (F3),
`package.json` (wire tbc:freshness), `scripts/hooks/commit-msg` (wire F4 at commit time).

### F4 · per-build enforcement (verify-freshness.mjs)

- change: new gate. When the change touches `^(src|scripts|migrations)/` and does not also
  add/modify a dated `docs/tbc/<date>-<slug>/` dir and the commit lacks a `TBC-Exempt:`
  trailer, it fails. Wired into `npm run tbc` (CI/check via the committed range) and into
  `scripts/hooks/commit-msg` (commit time, where the message is available for the trailer).
- write-path: exists — the gate is invoked by the commit-msg hook (`node
  scripts/tbc/verify-freshness.mjs "$COMMIT_MSG_FILE"`) and by `npm run tbc`. A developer
  triggers it by committing.
- read-path: exists — its exit code blocks the commit / reds `check`; its message tells the
  developer how to comply. Consumed, not dead.
- reachability status: **BUILT** — confirmed by H1 (staged code without a dir → red; with a
  dir or TBC-Exempt → pass).

### F3 · assurance-word context requirement (verify-artifacts.mjs)

- change: single ambiguous assurance words (`verified`/`green`/`passing`) now count as a
  verification claim only when a `VERDICT_CONTEXT` token (gate/check/test/build/ci/lint/
  tbc/exit/…) sits within ~60 chars; multi-word verdicts still always count.
- write-path: exists — the guard clause runs inside the existing `ASSURANCE` loop in
  verify-artifacts, over every artifact.
- read-path: exists — the loop's `r.fail` output is what the developer reads; the change
  only suppresses the false-positive branch.
- reachability status: **BUILT** — confirmed by H2 (prose cases return []; real verdicts
  still flagged).

## Verification (A38)

Detection tests, run by name this session, with their outcomes:

```
F4:  staged code, no build dir, plain msg   → node verify-freshness.mjs → RED   [exit 1]
F4:  same, with `TBC-Exempt:` trailer        → node verify-freshness.mjs → PASS  [exit 0]
F3:  "verified users" / "a passing mention"  → not flagged  (context absent)
F3:  "all gates green" / "gates pass"        → flagged      (context / multi-word)
```

The full canonical `npm run check` (now running all five tbc gates incl. freshness) is
pasted in closure.md's verification record with its exit code. `not-run`: NONE.
`untested`: NONE.
