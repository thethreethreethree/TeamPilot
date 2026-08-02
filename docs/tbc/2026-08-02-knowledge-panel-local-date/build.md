# BUILD — knowledge panel local date

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change
`src/components/care/AdaptiveKnowledgePanel.tsx` (line ~298) — the version-date label.

- Was: `{new Date(v.createdAt).toISOString().slice(0, 10)}` (UTC calendar date).
- Now: `{new Date(v.createdAt).toLocaleDateString("en-CA")}` (viewer-local `YYYY-MM-DD`).
- Added an inline comment stating why local, referencing the sibling convention + the chats/utils warning.

`en-CA` is used specifically because its date format is `YYYY-MM-DD` — this preserves the existing fixed-width
`font-mono` look while switching UTC → local. No data / API / schema change.

Files:
- `src/components/care/AdaptiveKnowledgePanel.tsx`
