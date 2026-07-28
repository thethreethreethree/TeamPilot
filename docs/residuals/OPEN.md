# Open residuals

> The residual queue is a **work queue, not a disclaimer** (`A36`, BUILD-PROTOCOL.md §7).
> At the start of every subsequent build, read this file — per §1.1, residuals are
> assets, not admin. A line here is not closed until it is checked off with an outcome.

## Filed on TBC installation (2026-07-28)

Per BUILD-PROTOCOL.md §12.3, installing the standing build protocol creates these open
residuals. They are recorded here, not resolved, because each is a governed-document
change or a structural rebuild that is out of scope for the install itself.

- [ ] 2026-07-28 · install-tbc-gates · ThinkerThinker.md embeds a **pre-amendment copy** of the constitution under the heading `# CLAUDE.md — Project Operating Constitution` (its lines 1–206), missing §0.1, §1.5.1, §1.5.2, §1.7, §7.
      why-unresolved: two divergent copies of a governing text is the `A16` class applied to the constitution itself. Fixing it edits ThinkerThinker.md (a governing doc) and changes its manifest hash — it must be done as its own governed change with the `A16`/R1.2 subset-check ("verify the embedded block is a strict subset of CLAUDE.md before deleting; STOP if the diff is not empty"), not folded into the install.
      next-action: replace ThinkerThinker.md lines 1–206 with a pointer — *"Constitution: see `CLAUDE.md`. This file is the asset library."* — regenerate DOC_MANIFEST.json in the same commit.

- [ ] 2026-07-28 · install-tbc-gates · ThinkerThinker.md **Index by topic** is stale — it covers to ~A29 while the library runs to A39, so A30/A33/A35/A36/A38 (the assets that govern this very protocol) are unreachable by topical lookup.
      why-unresolved: index rebuild is a separate content task; topical lookup is `grep`, not the index, until it is rebuilt.
      next-action: regenerate the index and add a gate that fails when the highest indexed asset lags the highest captured asset.

- [ ] 2026-07-28 · install-tbc-gates · "ThinkThinker.md" → "ThinkerThinker.md" naming drift appears in prose in THINK_BUILD_CHECK.md / BUILD-SYSTEM-PREP.md.
      why-unresolved: a literal `find` for the misspelled name fires the stop-condition; verify-docs.mjs already fails on an unresolvable manifest path (R3 closed for the manifest, open for prose references).
      next-action: fix the string in the source prompts. Verified zero code impact (the misspelling appears only in docs).

## Filed by the post-install gate audit (2026-07-28)

Proactive audit of the now-mandatory gates (they block `npm run check` team-wide, so a
false positive is costly — A33: a gate that cries wolf is one people learn to skip, and the
real leak rides in behind six fake ones). Both findings are CONFIRMED by test, not theorized.

- [ ] 2026-07-28 · gate-audit · F2 — the citation regex in scripts/tbc/lib.mjs (CITATION_RE) treats BARE `A<1-3 digits>` as a constitutional citation, so `A4` (paper size), `A100` (GPU), `A3` (figure ref), `A1` (grade/cert) all get flagged as needing a manifest entry.
      why-unresolved: changing the detection semantics of the mandatory protocol is a founder-level design call, not a self-authorized rewrite of the founder's gate. CONFIRMED: `extractCitations("render to A4 paper")` returns `["A4"]`.
      next-action (RECOMMENDED, precedent-backed per A28): align the asset-citation form to require the section sign — match the repo's OWN established `scripts/hooks/commit-msg` regex, which uses `§A[0-9]+` (sign required). That precedent already decides it: the commit-msg hook does NOT treat bare `A4` as a citation, so the TBC gate should not either. This narrows the gate to the established boundary; the unconditional minimum-set check (which is keyed on declared IDs, not extraction) is unaffected, so A19/A22/A30/A38 stay enforced. Any such fix is itself a TBC-governed build.

- [ ] 2026-07-28 · gate-audit · F3 — the assurance-word regex (ASSURANCE in scripts/tbc/verify-artifacts.mjs) fires on ordinary prose: "a passing mention", "turned green", "identity-verified users" all match, and go red if not within ~1200 chars of a fenced command + exit code.
      why-unresolved: narrowing the word list risks MISSING real "verified"/"passing" claims (a false negative is worse here), and the near-fence window already mitigates most cases. The honest instrument per gate-honesty policy is the allowlist, not a fuzzier regex.
      next-action (RECOMMENDED): leave the regex as-is; when a legitimate prose use trips it, add the specific `docs/tbc/<dir>/<file>.md` to ALLOWLIST.json under the `artifacts` key WITH ITS REASON (the loader already rejects reasonless entries). Only tighten the regex if the false-positive rate proves high in practice — the gate-honesty rule's "fix the gate or delete it" bar.

- [ ] 2026-07-28 · gate-audit · F4 (SHARPEST — goes to whether the protocol achieves its purpose) — `currentBuildDir()` returns the lexically-greatest EXISTING dir under docs/tbc/. Now that the install dir (2026-07-28-install-tbc-gates) is permanently committed, every future `npm run check` finds a valid latest dir and passes `tbc` — INCLUDING a new build/commit that created NO artifacts of its own. The "every substantive build needs its own docs/tbc/<date>-slug>/" mandate is therefore NOT mechanically enforced: it relies on the developer voluntarily creating a new dir, which is the exact discretionary-invocation failure (A38) the whole protocol exists to eliminate.
      why-unresolved: closing it is a founder-level design addition (changes what the mandatory protocol enforces), not a self-authorized rewrite. CONFIRMED by test: parking the only build dir turns tbc red; with ANY valid dir present, tbc stays green regardless of whether the current change created one.
      partial mitigation already in place: the commit-msg citation path DOES bite — a commit that cites a section/asset with no matching manifest entry in the latest dir goes red. So a build that cites its governing clauses is partially caught; a build that cites nothing and skips the dir is not.
      next-action (RECOMMENDED): add a freshness/association check to verify-manifest — when the staged/committed diff touches non-doc code, require a build dir whose think.md started_at is within the session AND/OR that the commit message names its build dir (TBC_BUILD) and that dir is complete. This is the amendment's own "did it take?" test (its section 7.5): without it, TBC can silently degrade into the install dir standing in for every future build. Surfaced, not self-applied — but this is the one I'd prioritize.
