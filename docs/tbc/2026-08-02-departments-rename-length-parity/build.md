# BUILD — departments rename length parity

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change
`src/app/api/departments/route.ts` — the PATCH rename branch.

- Was: `if (!body.name || body.name.trim().length === 0) → 400 "Name required."` (presence only).
- Now: trims to `renameName` and enforces `length === 0 || length > 80 → 400 "Name must be 1-80 chars."` —
  byte-for-byte the same rule the POST create branch already applies. Passes the trimmed name to
  `renameDepartment` (which also trims — idempotent).
- Inline comment records WHY (the `name text` column has no DB cap, so the route rule is the only guard, and
  it was missing on rename).

No change to auth (admin-only), rate-limit, the archive/unarchive actions, or the schema.

Files:
- `src/app/api/departments/route.ts`
