# BUILD — C.A.R.E AI-labor-mix read-only script

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change

### care-labor-mix.mjs
`scripts/care-labor-mix.mjs` (new) — a read-only live-DB analytics script mirroring
`verify-invariants-live.mjs`'s env-load + `pg` connection.

- **write-path:** none by design — the script runs a single SELECT (a CTE over `support_conversations` +
  `support_messages`) and prints. It never writes; there is no INSERT/UPDATE/DELETE and no rolled-back probe.
  The "output" is stdout: the 3-tier partition (fully_deflected / copilot_assisted / fully_manual), the N, and
  a DIRECTIONAL-ONLY warning when N < 200 (§3.4 honesty).
- **read-path:** reads `support_conversations` where `status='resolved'`, LEFT JOIN `support_messages`, and
  classifies each conversation by `count(author_type='agent')` and `count(author_type='agent' AND NOT
  co_pilot_invoked)` — i.e. the exact columns migration 0040 added. Consumed by the founder via
  `npm run care:labor-mix`.

### npm alias
`package.json` — added `"care:labor-mix": "node scripts/care-labor-mix.mjs"` beside `verify:live`, so the tool
is discoverable the same way.

## Files
- `scripts/care-labor-mix.mjs` (new)
- `package.json` (one script line)
