# governance/ — a version-controlled backup, not a second source of truth

Added 2026-09-29, Phase 0 step 1 of `docs/MOBILE-UNIFIED-PIPELINE-PLAN.md` in the website repository.

The app's rules and design gates live in `C:\Users\johns\IOS-APP\` — the folder ABOVE this repository,
which is not under git. Most of it was already safe: 52 of its 61 files are byte-identical to files
tracked in `BUILD-STARTER V3 APP SYSTEM/` here, because they are installed from that kit. Those are
deliberately NOT duplicated in this folder (a third copy is the drift the plan exists to remove), and
`IOS-APP/.gitignore` keeps the kit's law files out of git on purpose.

`IOS-APP/` holds these 9 files that exist nowhere else, so they are kept here verbatim:

| File | Why it is unique |
|---|---|
| `IOS-APP/DESIGN-CONTRACT.md` | This app's design contract |
| `IOS-APP/REVISIONS/REV 1.pdf` | The founder's REV 1 feedback on the app (3 pages, with two annotated phone screenshots) |
| `IOS-APP/.claude/settings.json` | The customised session settings (differs from the kit) |
| `IOS-APP/.claude/hooks/law-read-gate.mjs` | The customised read gate (differs from the kit) |
| `IOS-APP/.claude/graphic-inspections.json` | The LAW 1 graphic-inspection ledger |
| `IOS-APP/hook-fix.mjs`, `IOS-APP/scripts/*.mjs` | One-off repair script and the Evidence Protocol scripts |
| `IOS-APP/.gitignore` | The folder's own ignore rules |

The `.claude/` here is nested, so Claude Code does not load it — it is an inert copy.

**The originals in `IOS-APP/` are still the ones in use.** If you change one there, copy it here. Phase 1
of the plan makes a single canonical location and removes this folder.
