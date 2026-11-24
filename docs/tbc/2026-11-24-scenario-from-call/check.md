# CHECK - Practice scenario drafted from a real call

## Commands

```
npx vitest run callScenarioDraft + scenarios routes (incl. draft) + TrainingManager.draft.render → first: 1 failed (my expected string lacked a trailing period) → fixed → 23 passed
```

## Findings

### F1 - a drafted scenario could carry the customer's personal details past erasure
class: derived text stored where erasure only retires, not blanks (0317).
sweep: the only other scenario writer is the manager's hand-typed form (unchanged; recorded in 0317).
severity: high (privacy)

### F2 - the "from this call" path was unreachable
class: a feature wired at one end only.
sweep: grep for fromSession: TrainingManager only.
severity: medium

## Final

```
npm run check → first: ✗ americanSpelling ("practise" in the new prompt) → "practice" → exit 0 · Test Files 926 passed | 1 skipped · Tests 6774 passed | 15 skipped
```
