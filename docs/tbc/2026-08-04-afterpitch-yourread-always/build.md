# BUILD — After-Pitch "Your read" shows on every session

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change

### Narrative always renders + honest empty state
`src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx`.

- **write-path:** removed `if (!narrative.hasSignal) return null` from the `Narrative` component, so the "Your
  read" section now renders on every after-pitch that shows a summary. Added a conditional empty-state paragraph
  inside the open block that renders when `!narrative.hasSignal` (a call too thin to review) — an honest short
  message, not a fabricated read. The existing strengths / opportunities blocks render unchanged when there IS a
  narrative.
- **read-path:** reads the same `narrative` prop; `narrative.hasSignal` now selects between the real read and
  the honest empty state instead of hide/show. No change to the review engine, scores, `salesReview.ts`
  MIN_AGENT_SEGMENTS, privacy, or the Standard/Expert open-state behaviour.

## Files
- `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx`
