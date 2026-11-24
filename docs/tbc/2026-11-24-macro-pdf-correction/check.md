# CHECK - Macro Mode follows the PDF for everyone

## Commands

```
swift pdfdump.swift (PDFKit) → 3 pages, text + p1–p3.png viewed (EVIDENCE.md 2026-11-25)
npx vitest run src/components/remote-sales src/components/sessions src/components/sales-coach → first: 5 failed (2 encoded the old manager rule; 3 Calls tests had no router mock) → tests rewritten to the decision + router mocked → 622 passed
npx vitest run RemoteCallPanel.simple.render + RemotePipeline.simple.render → 5 passed
```

## Findings

### F1 - every Macro simplification was invisible to a manager
class: a rule scoped by role that the person judging it doesn't hold.
sweep: every reader of useRemoteMacroMode (shell, pipeline, today, calls, call page) — all now use macro === true alone.
severity: high (the founder's specified interface not delivered)

### F2 - removing stage chips would hide why a new call's tabs are empty
class: a simplification removing the only explanation of an empty state.
sweep: the Macro call page's other removed parts (consent, downloads, clips, trims, stats) explain no empty state.
severity: medium

### F3 - a test I wrote for opening a table row asserted nothing useful
class: a test that passes whether or not the behavior works.
sweep: the other new tests assert visible results (columns, buttons, a redirect call).
severity: low

## Final

```
npm run check → first: ✗ tbc:manifest (§3.1 reason too short) → fixed → exit 0 · Test Files 914 passed | 1 skipped · Tests 6718 passed | 15 skipped
```
