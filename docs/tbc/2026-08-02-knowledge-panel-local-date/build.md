# BUILD — knowledge panel local date

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change

### Local version-date rendering
`src/components/care/AdaptiveKnowledgePanel.tsx` (~line 298) — the version-date label.

- **write-path:** none — this change is display-only; the stored `v.createdAt` timestamp is untouched (it was
  always correct), and no data / API / schema changes.
- **read-path:** the label now renders `{new Date(v.createdAt).toLocaleDateString("en-CA")}` (viewer-local
  `YYYY-MM-DD`) instead of `toISOString().slice(0, 10)` (UTC), so an evening-west-of-UTC edit no longer reads a
  day ahead. `en-CA` is chosen specifically because its format is `YYYY-MM-DD`, preserving the fixed-width
  `font-mono` look while switching UTC → local. An inline comment records why (matches the sibling
  `toLocaleDateString` convention + the chats/utils warning).

Files:
- `src/components/care/AdaptiveKnowledgePanel.tsx`
