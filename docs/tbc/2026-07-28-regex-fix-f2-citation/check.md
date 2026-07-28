# CHECK — F2 fix audit

Audited the built file (`scripts/tbc/lib.mjs`, the changed `CITATION_RE` at the
citation chokepoint), not the intent.

## Within-module pass (four layers)

- **1 structure:** the change is a deletion of one alternation — fewer branches, one
  chokepoint. No new state. Sound.
- **2 effectivity:** re-probed live — `extractCitations` catches `§A26`/`§1.5.1`/`§6`,
  drops `A4`/`A100`/`A3`/`A1`. The gate's real job (flag un-manifested §-citations) is
  intact; the noise is gone.
- **3 composition:** the four gates still pass against the install bootstrap (no
  regression); the minimum-set enforcement is untouched because it reads DECLARED ids.
- **4 surface:** a legitimate future `build.md` mentioning "A4 paper" no longer reds the
  build.

## Cross-module pass (A21)

The citation-detection concept lives in two surfaces. Before: `scripts/hooks/commit-msg`
required the sign (`§A[0-9]+`), while `scripts/tbc/lib.mjs` matched bare `A<n>` — same
concept, two behaviours (the A21 failure class). After: both require the sign. Parity
confirmed — the two surfaces now agree on what a citation is.

## Class sweep (A26)

- class: a detector regex that matches an ordinary-language token without a required sigil,
  producing false positives on prose.
- sweep: `grep -nE "RegExp|matchAll|\.match\(" scripts/tbc/*.mjs` — boundary is every regex
  in the tbc scripts.
- result: the only other prose-matching detector is `ASSURANCE` in `verify-artifacts.mjs`
  (it fires on ordinary words — a casual mention, a colour word, a domain term like
  identity-checked users) — already filed as F3 with the recommended fix (allowlist, not
  regex-tightening). The remaining regexes (`EXIT_CODE`,
  the `line_range` parser, `frontMatter`, `jsonBlocks`) match STRUCTURED patterns, not
  free-token prose, so they are not in this class. Swept clean beyond the already-filed F3.

## Findings

No findings beyond the two already on the queue (F3 — assurance-word noise, recommended
allowlist; F4 — the mandate is not per-build enforced, needs a founder design decision).
Neither is in scope for this single-file fix; both remain in docs/residuals/OPEN.md.

## Inspected / not-inspected

- **Inspected:** `scripts/tbc/lib.mjs` (the change + `extractCitations`); all four gates
  re-run against the install bootstrap; the citation behaviour probed directly.
- **NOT inspected (→ residual):** the F2 fix's interaction with a build that *intends* a
  bare-`A` citation (now uncaught) — worked in closure.md; matches the commit-msg hook's
  own limit, so acceptable.
