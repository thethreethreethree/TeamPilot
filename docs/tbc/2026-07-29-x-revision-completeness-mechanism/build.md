# BUILD — revision-completeness mechanism

Files: `docs/BUILD-STATE.md` (durable ledger), `scripts/tbc/verify-revision.mjs` (gate),
`docs/tbc/<dir>/revision.md` (per-build manifest — this build + retro sales-coach),
`BUILD-PROTOCOL.md` (standing protocol), `package.json` (runnable `tbc:revision` script),
`docs/amendments/AMD-009-*.md` (mandatory-status proposal).

### Durable unfinished-work + risks ledger

- write-path: **exists** — `docs/BUILD-STATE.md` created with the real current state: an ACTIVE BUILD
  table (M1–M7 with dispositions), a CARRY-OVER queue (Settings scope, definer-revoke 0200, env vars,
  Voice — each with its risk), and a RECENTLY-CLOSED rolling log. human_can_set: the agent updates it the
  moment a disposition changes.
- read-path: **exists** — the file leads with "READ THIS FIRST ON RESUME"; a resume reads it to recover
  exactly what was mid-flight and every unfinished item's risk. human_can_see: **yes** — top-down list.
- reachability: **BUILT** — file present; referenced by the gate (REV-1 fails if it is missing) and the
  protocol doc.

### Revision-completeness gate (scripts/tbc/verify-revision.mjs)

- write-path: **exists** — the gate reads currentBuildDir; if `revision.md` is present it parses each
  `{id, verb, item, disposition}` item and fails on: no valid disposition (REV-3), "done" without evidence
  (REV-4), "deferred" without a reason (REV-5), or a deferred item absent from the ledger (REV-6). REV-1
  fails if the ledger file is missing. human_can_set: the author writes revision.md during BUILD.
- read-path: **exists** — `npm run tbc:revision` prints the pass/fail with the offending item id and the
  actionable reason; binds at closure like verify-residual. human_can_see: **yes** — gate output.
- reachability: **BUILT** — detection test in check.md drives both branches (fail on bad manifest, pass on
  honest one).

### Per-build revision manifest (revision.md)

- write-path: **exists** — this build's `revision.md` lists M1–M7 (M6/M7 deferred with reasons); the retro
  `revision.md` on the sales-coach build lists SC1 (declutter) + SC2 (routing), both done with evidence.
- read-path: **exists** — the gate consumes it; a human reads it as the item-by-item trace from the
  instruction to the implementation. human_can_see: **yes**.
- reachability: **BUILT** — tbc:revision returns exit 0 against currentBuildDir (this build's manifest;
  the run is in check.md's detection test).

### Standing protocol + runnable script + proposal

- write-path: **exists** — `package.json` gains `"tbc:revision"` (runnable now); `AMD-009` carries the
  verbatim BUILD-PROTOCOL.md sections 7.1 + 8.3 text AND the exact one-line mandatory-chain diff, for
  insertion on ratification (BUILD-PROTOCOL.md is amendment-governed, not edited pre-ratification).
  human_can_set: the founder ratifies AMD-009.
- read-path: **exists** — `npm run tbc:revision` runs the gate; the protocol doc is the operational
  reference; AMD-009 is the on-record rationale + ratification target. human_can_see: **yes**.
- reachability: **BUILT** (runnable) / **DEFERRED** (mandatory-chain wiring — M7, awaits ratification).

## Verification (A38)

`npm run check` output + exit code, and the gate detection test, are in check.md.
