# Session-Reads closure — governing-doc reconciliation (2026-07-28)

Build B: R1 (remove ThinkerThinker.md's embedded pre-amendment constitution → pointer to
CLAUDE.md), R2 (rebuild the asset index to A1–A39), R3 (naming drift closed as
not-a-defect). Founder-approved doc reconciliation; not a constitutional amendment (CLAUDE.md
is untouched; the removed TT copy was verified an exact subset of it).

Clauses touched in the diff appear only inside the new TT pointer text, which *names* the
sections the removed copy lacked (§0.1, §1.5.1, §1.5.2, §1.7, §7) to explain the drift — they
are descriptive, not relied-upon citations. The constitution itself (`CLAUDE.md`) is the sole
source and was read live this session (see the bootstrap manifests in docs/tbc/). DOC_MANIFEST.json
was regenerated for the new ThinkerThinker.md hash in this commit; `npm run check` exits 0.
