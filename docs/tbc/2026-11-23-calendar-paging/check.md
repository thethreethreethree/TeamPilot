# CHECK - Calendar reads the whole week

## Commands

```
npx vitest run src/app/api/coach/remote/calendar → 5 passed (1,203 calls → 1,203 held; 13 link reads; a failed read is still a 500)
```

## Findings

No findings: the cap was recorded as a residual; it is removed.

## Final

```
npm run check → first: ✗ tbc:manifest (§3.1 reason too short) → fixed → exit 0 · Test Files 900 passed | 1 skipped · Tests 6649 passed | 15 skipped
```
