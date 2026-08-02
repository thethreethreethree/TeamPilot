# BUILD — departments rename length parity

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change

### Rename length parity
`src/app/api/departments/route.ts` — the PATCH rename branch.

- **write-path:** the rename now trims to `renameName` and enforces `length === 0 || length > 80` before
  calling `renameDepartment` — byte-for-byte the same rule the POST create branch applies (was: presence-only,
  `if (!body.name || body.name.trim().length === 0)`). An inline comment records why (the `name text` column
  has no DB cap, so the route rule is the only guard, and it was missing here).
- **read-path:** a rename whose name is empty or >80 chars now returns `400 "Name must be 1-80 chars."` (was:
  accepted, persisting an over-long name); a valid rename still returns the updated department unchanged.

No change to auth (admin-only), rate-limit, the archive/unarchive actions, or the schema.

Files:
- `src/app/api/departments/route.ts`
