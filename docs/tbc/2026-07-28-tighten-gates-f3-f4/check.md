# CHECK — gate hardening audit

Audited the built files: `verify-freshness.mjs`, the `verify-artifacts.mjs` guard clause,
and the two wiring points (`package.json`, `scripts/hooks/commit-msg`).

## Within-module pass (four layers)

- **1 structure:** F4 is a single decision (enforced-path AND no-build AND no-exempt → fail);
  F3 is one guard clause. No new state, no duplication.
- **2 effectivity:** re-probed — F4 reds a staged code change lacking a build dir and passes
  one with a dir or a TBC-Exempt trailer; F3 stops flagging prose but still catches real
  verdicts. Confirmed by H1/H2.
- **3 composition:** F4 reads the STAGED diff at commit-msg time and the committed range at
  CI time — the two contexts where the data exists. It is deliberately NOT in the pre-commit
  hook, because pre-commit fires before the message exists and could not see the exempt
  trailer (a false-positive that would block a legitimate exempt commit).
- **4 surface:** F4's failure message is actionable (make a build or add the trailer).

## Cross-module pass (A21)

The F4 enforced-path concept and the commit-msg citation concept both read the staged diff;
they are consistent (both use git plumbing via lib.mjs). F3's assurance check composes with
the pre-existing fence+exit-code proximity check — the context requirement is applied first
as a filter, then the existing proximity logic runs unchanged.

## Class sweep (A26)

- class A (F4): a defense that only fires if the author chooses to invoke it (A38).
  sweep: the tbc gates + hooks. F4 closes the build-dir gap. The remaining bypass
  (`git commit --no-verify`) is inherent to git and already documented as friction, not
  enforcement (the commit-msg hook's own header says so).
- class B (F3): a detector regex that fires on ordinary prose (the same class as F2).
  sweep: `grep -nE "RegExp|matchAll|\.match\(" scripts/tbc/*.mjs` — CITATION_RE (F2, fixed)
  and ASSURANCE (F3, fixed here) were the two prose-matching detectors; the rest match
  structured patterns. Class swept.

## Findings

No findings. Both fixes are precise (A33): F4 fires only on code-without-a-build; F3 requires
verdict context. The one judgment call each (F4's enforced-path set; F3's context window) is
recorded as a residual, not left implicit.

## Inspected / not-inspected

- **Inspected:** verify-freshness.mjs; the verify-artifacts guard clause; both wiring points;
  the detection tests.
- **NOT inspected (→ residual):** F4's behaviour on a merge/rebase where the staged set spans
  many commits (evaluated via the committed range at CI, not exhaustively tested) — worked in
  closure.md.
