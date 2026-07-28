# Session-Reads closure — TBC build-protocol install + AMD-008 enactment (2026-07-28)

This is the `Session-Reads` manifest for the commit that installs the THINK·BUILD·CHECK
gates and enacts AMD-008. The full 23-entry session-read manifest (each with a this-session
`read_at` and a verified line range) lives in
`docs/tbc/2026-07-28-install-tbc-gates/think.md` — this file is the commit-hook-facing
pointer to it, plus the reads specific to enactment.

## Constitutional assets re-read this session (2026-07-28)

- **CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §1.7, §5, §6, §7.4** — read live from the working
  tree; line ranges recorded and gate-verified in the bootstrap `think.md`. §7.4 governs the
  gate on this commit (a CLAUDE.md edit only as the consequence of a ratified amendment,
  referencing it by ID — satisfied by AMD-008).
- **CLAUDE.md §2 / §7 / §7.2 / §7.3** — re-read to place the §2.1 clause and to record the
  ratification append-only per §7.3.
- **ThinkerThinker.md A16, A19, A20, A21, A22, A24, A26, A28, A29, A30, A31, A33, A35, A36,
  A38** — read live; line ranges in the bootstrap `think.md` manifest, gate-verified by
  `verify-manifest.mjs`.

## Enactment reads

- `scripts/invariant-audit.mjs` INVARIANT 12 — read to discover that ratifying AMD-008
  requires `src/lib/constitution.ts` to bump to `amendmentCount: 7` / `lastAmendmentId:
  AMD-008`, or `npm run check` breaks. This is why the constant is updated in this commit.
- `scripts/hooks/commit-msg` + `scripts/hooks/pre-commit` — read to enact the commit-time
  gate at the repo's real `core.hooksPath = scripts/hooks` (not `.husky/`).

## Verification

`npm run check` (now including the newly-wired `tbc` gate) returns exit 0 — pasted in the
bootstrap `docs/tbc/2026-07-28-install-tbc-gates/closure.md` and re-run at commit time.
