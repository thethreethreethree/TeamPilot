# BUILD — F5 line_range advisory

One file: `scripts/tbc/verify-manifest.mjs` — the line_range check in section 3.

### F5 · line_range advisory, id-in-file hard

- change: the check no longer fails when the id is absent from the hand-written range. It now
  fails only if the id appears NOWHERE in the named source_file (wrong file / invented
  citation). If the id is in the file but not in the stated range, it emits an advisory note
  ("line_range … is stale … re-point when convenient").
- write-path: exists — the check runs inside verify-manifest's per-entry loop over every
  manifest entry; a build author triggers it by running the gate.
- read-path: exists — a hard failure blocks the build (fabrication); an advisory note is read
  by the maintainer without blocking. Both consumed.
- reachability status: **BUILT** — confirmed by H1 (stale ranges pass with notes) and H2
  (fabricated id fails).

## Verification (A38)

Detection tests run by name, with exit codes:

```
H1  install dir (TT ranges stale post-R1)   → node verify-manifest.mjs → exit 0  (advisory notes)
H2  manifest id renamed to A97 (not in file) → node verify-manifest.mjs → exit 1  (does not appear anywhere)
    current build dir (accurate ranges)       → node verify-manifest.mjs → exit 0  (clean)
```

The full canonical `npm run check` is pasted in closure.md's verification record with its exit
code. `not-run`: NONE. `untested`: NONE.
