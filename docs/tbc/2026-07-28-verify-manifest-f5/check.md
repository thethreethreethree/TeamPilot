# CHECK — F5 audit

Audited the built file: the reordered line_range check in `verify-manifest.mjs`.

## Within-module pass (four layers)

- **1 structure:** the invariant (id lives in the file) is now the hard gate; the range is a
  post-hoc advisory. One failure branch for a real defect, one note for drift.
- **2 effectivity:** re-probed — a build dir with ranges shifted by a real governing-doc edit
  passes with notes; a fabricated id fails. The gate now fails on the actual defect, not on a
  proxy for it.
- **3 composition:** the minimum-set check, the read_at (session) check, and the citation-scan
  are all untouched; F5 only changes the range branch. No cross-check regressed.
- **4 surface:** the advisory note names the drifted id and its new approximate line, so a
  maintainer can re-point at leisure rather than under a red build.

## Cross-module pass (A21)

The "id lives in this file" concept also underlies the commit-msg citation hook (which greps
the diff for citations) — both now key on the id's existence, not on line numbers. Consistent.

## Class sweep (A26)

- class: a check coupled to a brittle PROXY (absolute line numbers) rather than to the
  invariant it means to enforce (the id lives here).
- sweep: `grep -nE "line_range|slice\(|lines\.length" scripts/tbc/*.mjs` — the only line-number
  coupling in the tbc scripts was this one check; `currentBuildDir`/`repoRel`/frontMatter use
  structural anchors, not asserted line numbers. Class swept; no sibling instances.

## Findings

No findings. F1–F4 were closed earlier; F5 is closed here — all five install-audit findings
are now disposed.

## Inspected / not-inspected

- **Inspected:** the reordered check; the detection tests against real stale ranges and a
  fabricated id; the untouched minimum-set/read_at/citation branches.
- **NOT inspected (→ residual):** the advisory note reports the id's FIRST occurrence line,
  which for an asset now listed in the rebuilt index is the index mention, not the heading —
  cosmetic only (the note is advisory), recorded in closure.md.
