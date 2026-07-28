# CLOSURE — F2 citation-regex fix

## 1. Session-read manifest

13 entries in think.md's manifest section (the 9-clause minimum set + A21/A26/A28/A33 for
the fix's rationale), each with a this-session read_at and a gate-checked line range.

## 2. Build inventory (reachability)

| Component | write-path | read-path | status |
|---|---|---|---|
| `scripts/tbc/lib.mjs` — CITATION_RE | applied in `extractCitations`, invoked by verify-manifest | verify-manifest consumes it to flag un-manifested §-citations | BUILT |

## 3. Verification record (A38)

Canonical command `npm run check`, run by name after the change, with this build directory
present so the newly-mandatory `tbc` gate binds to it:

```
> execos@0.1.0 check
> ... typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test
> execos@0.1.0 tbc
✓ tbc:docs
✓ tbc:manifest
✓ tbc:artifacts
✓ tbc:residual
> execos@0.1.0 test
      Tests  1602 passed | 15 skipped (1617)
EXIT=0
```

Coverage: 7-of-7 gates (incl. the F2 build dir binding `tbc`), exit 0. The fix is live and
the mandatory protocol governs its own tooling change.

## 4. Findings ledger

No findings originated in this build. The class swept (prose-matching detector regex) turned
up only the already-filed F3; F4 remains an open founder-design item. Neither is in scope for
this single-file fix.

## 5. Gates added

None. This build *reduces* a gate's false-positive surface rather than adding enforcement. The
detection now matches the established commit-msg hook (one behaviour across two surfaces).

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-28-F2-01",
    "item": "The narrowed regex now MISSES a citation someone wrote as a bare 'A26' (no sign).",
    "why_skipped": "Assumed harmless because artifacts conventionally use the sign; felt certain it does not matter.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-28T13:20:00Z",
    "outcome": "OPENED. Checked the install bootstrap's own artifacts: they use bare 'A26'/'A30' throughout, so those refs are no longer extracted — but the minimum-set (A19/A22/A30/A38) is enforced via DECLARED ids in the manifest, independent of extraction, so nothing that mattered was lost. And this exactly matches the commit-msg hook's long-standing behaviour (it never caught bare A either). Net: the un-named-reliance half (a bare-A someone leaned on but did not sign) was already un-gated by the commit-msg hook; this fix does not widen that hole, it aligns to it. Acceptable; if a citation must be gated, write it with the sign."
  },
  {
    "id": "RES-2026-07-28-F2-02",
    "item": "F4 — the mandate is not per-build enforced (currentBuildDir picks the committed install dir).",
    "why_skipped": "Out of scope for a single-file regex fix, and its fix risks blocking trivial commits — a founder design decision.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": "Not opened here — it genuinely matters (low confidence it does not). Tracked in docs/residuals/OPEN.md as the prioritised item; needs a founder call on the exemption policy before any enforcement is added."
  }
]
```

The top-ranked residual (highest confidence-it-does-not-matter) was opened per A36, and
opening it confirmed the trade-off is bounded and matches existing precedent.

## 7. Hypothesis outcomes

- **H1** (sign-required drops false positives, keeps real citations) — **CONFIRMED** by probe.
- **H2** (no regression on the install bootstrap) — **CONFIRMED**: all four gates exit 0 on it.

## 8. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `cc9071abd15ab7e06c3e89fef38f66da0b9df351ffa2afde50ec3d4664ef1d92`
