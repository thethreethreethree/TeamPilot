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
