# CLOSURE — revision-completeness mechanism

## 1. Session-read manifest

12 entries in think.md's manifest, each with a this-session read_at (validated by verify-manifest.mjs).
Clauses re-read this session: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md A19, A22, A26,
A30, A33, A36, A38.

## 2. Build inventory (reachability per A31)

| Feature | write path | read path | status |
|---|---|---|---|
| Durable ledger (docs/BUILD-STATE.md) | created, populated with real state | read-first-on-resume; REV-1 fails if missing | BUILT |
| Gate (verify-revision.mjs) | parses revision.md, 6 failure modes | `npm run tbc:revision` output | BUILT |
| Per-build manifest (revision.md) | this build (M1–M7) + retro sales-coach (SC1–SC2) | gate + human trace | BUILT |
| Runnable script + protocol | package.json `tbc:revision`; BUILD-PROTOCOL step | `npm run tbc:revision`; the doc | BUILT |
| Mandatory-chain wiring (M7) | proposed in AMD-009 with exact diff | founder ratifies | DEFERRED |

## 3. Verification record (A38)

Gate detection test (both branches driven), pasted in check.md: green EXIT=0 on the honest manifest,
REV-3 EXIT=1 on a partial one, restored EXIT=0. The full `npm run check` output + exit code:

```
> npm run check   (typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test)
  invariant:audit — Files scanned: 697 · Documented exceptions: 12 · Violations: 0
✓ CSV exports formula-safe · finance RLS-scoped · … · constitution metadata matches the ratified amendments
✓ tbc:docs
✓ tbc:manifest
✓ tbc:artifacts
✓ tbc:residual
✓ tbc:freshness
 Test Files  225 passed | 1 skipped (226)
      Tests  1602 passed | 15 skipped (1617)
CHECK_EXIT=0
```

The new `tbc:revision` gate (not yet in the mandatory chain — deferred to AMD-009) is green standalone:
`npm run tbc:revision` → "2 deferred item(s) all present in docs/BUILD-STATE.md" → exit 0.

## 4. Findings ledger

No findings. Additive tooling + docs; the class the founder named is now encoded in a gate (A30) rather
than a prose promise.

## 5. Gates added

`tbc:revision` (scripts/tbc/verify-revision.mjs) — the permanent structural fix. Runnable now; proposed
for the mandatory chain via AMD-009 (governance, A28 precedent = ratification, not self-imposition).

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-29-RCM-01",
    "item": "The mandatory-chain wiring (add tbc:revision to `npm run check`) is deferred to AMD-009 ratification, so a future revision build could technically skip writing a revision.md until the founder ratifies.",
    "why_skipped": "Making a gate mandatory is a governance act; the AMD-008 precedent routes that through founder ratification rather than agent self-imposition, and the founder is offline.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-29T05:40:00Z",
    "outcome": "OPENED. Reviewed the exposure: until ratified, the gate is runnable but not auto-enforced, so the discipline rests on the agent creating revision.md + the ledger by habit — the exact discretionary-invocation weakness the protocol dislikes. Mitigations in place NOW: (1) docs/BUILD-STATE.md is live and read-first-on-resume; (2) BUILD-PROTOCOL.md documents the manifest step as standing practice; (3) the runnable gate makes verification one command. Residual risk is bounded to the window before 'ratify AMD-009', and AMD-009 carries the exact one-line diff so ratification is trivial. Left open, tracked in docs/BUILD-STATE.md M7."
  },
  {
    "id": "RES-2026-07-29-RCM-02",
    "item": "The gate cannot detect a requested change the author FAILED TO DECLARE (e.g. a struck line missed while reading a screenshot) — only that the declared set is fully dispositioned.",
    "why_skipped": "That boundary is not mechanically detectable without false positives (A33): the gate cannot know what the image said.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-07-29T05:42:00Z",
    "outcome": "OPENED — it genuinely matters (it is the residual of the residual). The declaration discipline (enumerate every mark FIRST, in BUILD, before editing) + the durable ledger close it by habit; the gate makes the declared set's completeness structural. Recorded as the honest boundary in revision.md and A33's manifest entry rather than papered over with a false claim of total coverage."
  }
]
```

Top-ranked residual (RCM-01, medium) is opened with an outcome per A36.

## 7. Hypothesis outcomes

- **H1** (a precise gate blocks reported-done-while-partial for the declared set) — CONFIRMED by the
  detection test.
- **H2** (mandatory now would overtake governance; ship runnable + propose) — CONFIRMED; INV12 stays
  satisfied with a proposed AMD-009 (only ratified amendments are counted).

## 8. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
