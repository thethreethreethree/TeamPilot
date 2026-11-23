# CHECK - Legal erasure reaches reps' day plans

## Commands

```
node scratchpad/replay0322.mjs (PGlite: every migration, then 0322 again) → phone matches [4, 1] ((555) 010-0123, 555.010.0123, 5550100123) · email [2] · name [1] · rules hold outside erasure (update/delete ignored) · erase phone in [1, 3, 4] → 2 plans changed (3 doesn't mention it, untouched) · completion recorded (sessions_erased 0) · second run refused ("already carried out") · name erase replaces "Betty Ross" only · rules hold after
npx vitest run src/app/api/coach/remote/erasure → 21 passed (plans listed with rep + day only; plans erased before calls with the searched identifier; plans-only completes; an unsearched plan refused, nothing written)
npx vitest run ProtectionSettings → 6 passed (plans-only customer listed and erased from the panel)
npm run db:apply → applied 0322 · DB now at 0322 · ✅ ALL 33 invariants hold
node scratchpad/check0322.mjs (production) → all three functions: authenticated false · service_role true · search runs (0 day plans in production yet) · both rules erasure-aware
npm run check (before the record) → exit 0 · Tests 6636 passed
```

## Findings

### F1 - a customer named only in a day plan could not be erased at all
class: erasure keyed to calls; any personal data not tied to a call is outside it.
sweep: tables with customer-identifying free text not keyed to a call — remote_day_plans (now covered); prospects'
name/organization (covered by 0316 via linked calls; an unlinked prospect is covered only if linked — recorded below).
severity: high (legal)

## Final

```
npm run check → first: ✗ tbc:manifest (§3.4 reason; its "how" also overstated a panel hint — corrected) → ✗ tbc:artifacts (Find lacked a write-path, Erase a read-path) → added → exit 0 · Test Files 899 passed | 1 skipped · Tests 6636 passed | 15 skipped
```
