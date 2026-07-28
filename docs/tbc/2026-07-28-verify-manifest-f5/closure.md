# CLOSURE — F5 line_range advisory

## 1. Session-read manifest

11 entries in think.md's manifest section, each with a this-session read_at. Line ranges are
accurate at authoring; under F5 a later doc edit would note-not-fail them.

## 2. Build inventory (reachability)

| Component | write-path | read-path | status |
|---|---|---|---|
| `verify-manifest.mjs` line_range check | runs per manifest entry | hard-fail on absent id / advisory note on stale range | BUILT |

## 3. Verification record (A38)

```
> execos@0.1.0 check
> ... invariant:audit && tbc && test
> execos@0.1.0 tbc
✓ tbc:docs
✓ tbc:manifest
✓ tbc:artifacts
✓ tbc:residual
✓ tbc:freshness
> execos@0.1.0 test
      Tests  1602 passed | 15 skipped (1617)
EXIT=0
```

Coverage: 7 gates incl. the five tbc sub-gates, exit 0. F5 live and non-breaking.

## 4. Findings ledger

No findings. F5 is the last of the five install-audit findings; all are now disposed
(F1–F4 fixed earlier, F5 fixed here).

## 5. Gates added

None added; one gate made robust. verify-manifest now fails on the real defect (an id that
lives in no named file) and stops failing on an honest stale range — removing the coupling
that made every governing-doc edit also a manifest edit.

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-28-F5-01",
    "item": "Demoting the exact range to advisory weakens the 'did you actually open the file' signal.",
    "why_skipped": "Assumed harmless because read_at + id-in-file cover it; felt certain the exact range added little.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-28T15:25:00Z",
    "outcome": "OPENED. The exact range was never strong proof of opening — a plausible range can be guessed, and the id-existence check plus the this-session read_at timestamp are the real signals (and both remain hard checks). What the strict range actually did was couple the manifest to line numbers and RED honest builds after doc edits, training re-point rituals (A33 noise). Net: the 'open it' guarantee rests on read_at (unchanged), not on a line window; F5 loses no real assurance and removes a false-failure. Confirmed acceptable."
  },
  {
    "id": "RES-2026-07-28-F5-02",
    "item": "The advisory note reports the id's FIRST occurrence line, which for an indexed asset is the index mention, not the heading.",
    "why_skipped": "Cosmetic — the note is advisory and only points 'near' a line for convenience.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": null
  }
]
```

Top residual opened per A36; opening it confirmed the exact-range check was a brittle proxy,
not a real assurance, so demoting it costs nothing the read_at timestamp did not already carry.

## 7. Hypothesis outcomes

- **H1** (stale ranges pass with notes) — **CONFIRMED** against the install dir.
- **H2** (fabricated id still fails) — **CONFIRMED**.

## 8. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
