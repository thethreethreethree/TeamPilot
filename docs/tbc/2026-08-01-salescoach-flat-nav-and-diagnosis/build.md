# BUILD — Sales Coach flat nav + diagnosis

## Doc integrity (§0.1) — command + output think.md section 1 refers to

```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

### Flat, mode-universal Sales Coach sidebar
`src/components/sales-coach/SalesCoachShell.tsx` — NAV_SECTIONS collapsed to ONE headerless section (flat list,
founder's July-28 order): Home · Coach Assessment (mgr) · Analytics · Sessions · Roleplay · One Liners · Team
(mgr) · Team Chat · KPI Analytics · Settings.

- **write-path:** the NAV_SECTIONS data is now a single headerless section; removed the per-mode
  "Strategy→One Liners" relabel (now a universal label), the dead per-section numbering, and the now-unused
  `useExperienceMode`/`isStandard`/`ii`.
- **read-path:** the render loop skips the header `<p>` + numbering when `section.header` is undefined, so it
  draws as a flat, unnumbered list; `filterManagerNavSections` still hides `managerOnly` items from reps.

### "Edits don't stick" root-cause diagnosis doc
`docs/audits/2026-08-01-salescoach-stale-client-and-edits-diagnosis.md` — the write-up.

- **write-path:** records the origin (mode-specific edits + stale PWA/host + duplicated tooltip copy),
  grounded in a grep of the LIVE code for each crossed-out string.
- **read-path:** a founder/maintainer reads it to know the fix (mode-universal edits; verify on elostate.com)
  and why the edits WERE live all along.
