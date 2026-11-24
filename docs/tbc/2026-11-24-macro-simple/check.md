# CHECK - Macro Mode is the PDF, nothing else

## Commands

```
PDF read: 3 pages rendered (PDFKit) and read as images + text → EVIDENCE.md section "General Sales Interface for Elostate.pdf"
npx vitest run RemotePipeline.simple.render → 2 passed (rep in Macro Mode: tabs + five fields, no views / Ask / Close / lead source; manager or Macro Mode off: full)
npx vitest run src/components/remote-sales/__tests__ src/components/sessions → all passed
```

## Findings

### F1 - features added 2026-11-23 showed inside Macro Mode, against the PDF's "Nothing else"
class: new features added to shared screens without asking which mode they belong to.
sweep: RemotePipeline (views, Ask, risk, sentiment, close date, source, stage practice), RemoteToday (RepRoutine),
SessionDetailView macro branch (CallNotes). Trackers / Market / Coaching are manager tabs, not in a rep's Macro Mode.
severity: medium (the founder's stated product principle)

## Final

```
npm run check → first: ✗ lint (react-hooks/rules-of-hooks: a role hook after a short-circuit on Today) → both hooks called unconditionally → exit 0 · Test Files 908 passed | 1 skipped · Tests 6693 passed | 15 skipped
```
