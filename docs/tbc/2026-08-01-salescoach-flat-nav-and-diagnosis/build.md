# BUILD — Sales Coach flat nav + diagnosis

## Doc integrity (§0.1) — command + output think.md section 1 refers to

```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Changes

- `src/components/sales-coach/SalesCoachShell.tsx` — NAV_SECTIONS collapsed to ONE headerless section (flat
  list, founder's July-28 order): Home · Coach Assessment (mgr) · Analytics · Sessions · Roleplay · One Liners
  · Team (mgr) · Team Chat · KPI Analytics · Settings. Removed the per-mode "Strategy→One Liners" relabel (now
  universal), the dead per-section numbering, and the now-unused `useExperienceMode`/`isStandard`/`ii`.
- `docs/audits/2026-08-01-salescoach-stale-client-and-edits-diagnosis.md` — the "edits don't stick" root-cause
  write-up (mode-specific edits + stale PWA/host + duplicated tooltip copy), grounded in grep of the live code.
