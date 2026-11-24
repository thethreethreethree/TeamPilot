# CHECK - Search opens with the filters in its URL

## Commands

```
npx vitest run search page URL render + TeamCallStats.render → first: 2 failed (mock lacked usePathname; then the default grade=missed param in my exact-URL assertion) → asserted rep/from params → 4 passed
```

## Findings

No findings: the change reuses the existing parsers on both sides; tests cover with and without URL filters.

## Final

```
npm run check → exit 0 · Test Files 930 passed | 1 skipped · Tests 6783 passed | 15 skipped
```
