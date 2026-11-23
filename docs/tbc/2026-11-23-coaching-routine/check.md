# CHECK - The manager's weekly coaching routine

## Commands

```
npx vitest run routine.test.ts + WeeklyRoutine.render.test.tsx → 3 passed
npm run check → exit 0 · Test Files 880 passed | 1 skipped · Tests 6559 passed | 15 skipped
```

## Findings

### F1 - earlier residuals said there was no component-test harness for remote-sales screens
class: a claim about the codebase recorded without checking.
sweep: `grep -rln "@vitest-environment jsdom" src/components/remote-sales/__tests__` → RemoteSalesShell, MacroCallView,
WeeklyRoutine.
severity: medium

## Addendum 2026-11-23 — render tests for today's screens (closing the F1 correction)

```
CallNotesAndLink.render.test.tsx → 4 passed · InsightViews.render.test.tsx (calendar, market, adoption board) → 5 passed
SessionTranscript.edit.render.test.tsx → 2 passed · RemotePipeline.ask.render.test.tsx → 1 passed
mutation: goTo without setTab(p.status) → RemotePipeline.ask test 1 failed; restored (git diff empty)
npm run check → first: ✗ typecheck (notes array type in the new test) → fixed → exit 0 · Tests 6571 passed | 15 skipped
```

## Addendum 2026-11-23 — stage practice render test (correction closed)

```
RemotePipeline.stagePractice.render.test.tsx → 2 passed (rep starts the stage's practice → role-play; no button for someone who can't start it)
npm run check → exit 0 · Tests 6573 passed | 15 skipped
```
