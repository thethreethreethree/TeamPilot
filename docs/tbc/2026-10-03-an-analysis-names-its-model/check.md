# CHECK - an analysis names its model

## Commands

```
$ (production, read-only) select model, prompt_version, count(*) from pitch_analyses group by 1,2
  brain  doorlog-analysis-v2  90
  brain  doorlog-analysis-v1  10
$ npx tsc --noEmit -p .
exit 0
$ npx vitest run src/lib/coach/doorlog
 Test Files  21 passed (21)
      Tests  157 passed (157)
exit 0
$ (mutation: worker.ts back to "brain")        worker.test.ts       Tests  1 failed | 39 passed   exit 1 (restored)
$ (mutation: rollupWorker.ts back to "brain")  rollupWorker.test.ts Tests  1 failed | 6 passed    exit 1 (restored)
```

The full `npm run check` is appended below.

## Findings

### Every analysis and summary stored the literal "brain" as its model

class: a provenance column written with a constant instead of the value the call returned
sweep: grep -rnE "model: \"brain\"" src (2 writers, both fixed)
severity: low

The 100 analyses and 80 summaries already stored keep "brain"; history is not rewritten.

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Full gate (two runs)

```
$ MIGRATION_AUDIT_PSQL=... PGPORT=55433 ... npm run check
run 1: exit 1   tbc:manifest: the section-6 entry's why_it_governs restated the title (too short to be a reason); reworded
run 2: exit 0
 Test Files  730 passed | 1 skipped (731)
      Tests  5676 passed | 15 skipped (5691)
```
