# CHECK - Ask Coach across the pipeline

## Commands

```
npx vitest run src/lib/coach/remote/__tests__/askPipeline.test.ts → 8 passed, exit 0
npx tsc --noEmit -p . → exit 0
```

## Findings

### F1 - prospect names and call summaries go to the AI provider
class: the prompt carries prospect names, organizations and brief text — the same kind of customer data Ask Coach
already sends as full transcripts, and less of it.
sweep: `grep -rn "askCoachTurn(" src --include=*.ts` → askCoach.ts and askPipeline.ts are the two callers; both send
call-derived customer text.
severity: low

### F2 - an answer could outlive the pipeline it was about
class: per-view state that survives a change of whose data is on screen (the same class fixed in RemotePipeline's load()
on 2026-11-23).
sweep: `grep -n "key={whose}" src/components/remote-sales/RemotePipeline.tsx` → the box is keyed by the selected
pipeline, so switching remounts it empty.
severity: low
