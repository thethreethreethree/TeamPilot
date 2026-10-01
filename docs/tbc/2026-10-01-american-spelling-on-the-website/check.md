# CHECK - American spelling on the website

## Commands

```
$ npx vitest run src/components/sales-coach/__tests__/americanSpelling.test.ts
      Tests  1 passed (1)
exit 0
$ (mutation: Training back to "Reps practising")
      Tests  1 failed (1)   — "src/app/dashboard/sales-coach/training/page.tsx:67 \"practising\""
exit 1   (restored)
```

The full `npm run check` is appended below.

## Findings

### British spellings on website screens after REV 1

class: copy that drifts from a stated language standard, one word at a time
sweep: the guard itself; it reads every .tsx outside tests and captures
severity: low

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Appended — the full gate (against postgres:16-alpine)

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 npm run check
      Tests  5605 passed | 15 skipped (5620)
  RLS probes:              1 run, 0 failed
CHECK_EXIT=0
```

A first attempt stopped at tbc:manifest (one manifest reason was too short); it was reworded and re-run.

## Appended 2026-10-01 — R1 closed: .ts files are scanned too

The guard now reads .ts as well as .tsx. It found British forms in five AI prompts (practiceScenario
"practise", coachingMaterial "practise", analyze "summarised", rollup "summarise" and "behaviour",
pitchScorePrompt "recognising"), in the product knowledge the AI assistant answers from ("colour-coded",
"cost-centre"), and a variable named `centre` (renamed `center`). A rep never reads a prompt, but its wording
leans the model's, and the model's output is read. All changed; meaning untouched. heuristics.ts is exempt
with its reason: its patterns match what people type and deliberately accept both spellings.

```
$ npx vitest run src/components/sales-coach/__tests__/americanSpelling.test.ts src/lib/coach src/lib/care
      Tests  2214 passed (2214)
exit 0
$ (mutation: "practise" put back in practiceScenario.ts)
      Tests  1 failed (1)   — "src/lib/coach/v5/practiceScenario.ts:35 \"practise\""
exit 1   (restored)
```

```
$ MIGRATION_AUDIT_PSQL="docker exec -i pgprobe psql -U postgres" PGHOST=localhost PGPORT=55433 npm run check
      Tests  5605 passed | 15 skipped (5620)
  RLS probes:              1 run, 0 failed
CHECK_EXIT=0
```
