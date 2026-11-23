# CHECK - Legal erasure reaches unlinked pipeline prospects

## Commands

```
node scratchpad/replay0323.mjs (PGlite, every migration then 0323) → matches: d1 "Betty Ross"/"Ross Bakery", d2 "Sam Lee"/"Betty Ross Holdings" · delete outside erasure ignored (6 kept) · erase [d1, d3] → 1 (d3 doesn't match, untouched) · d1 → "(erased on request)", organization null, amount 900 kept · task → "To-do (details erased on request)" · completion recorded · rules hold after
npx vitest run src/app/api/coach/remote/erasure → 25 passed · ProtectionSettings → 7 passed (Sam Lee unticked, only p1 sent)
npm run db:apply → applied 0323 · DB now at 0323 · ✅ ALL 33 invariants hold
node scratchpad/check0323.mjs (production) → both functions: authenticated false · service_role true · search runs · 0 prospects in production
```

## Findings

### F1 - an organization can contain the customer's name for a different person
class: substring matching across names.
sweep: name and organization are both searched; the panel shows both for each prospect so the admin can untick.
severity: medium

## Final

```
npm run check → exit 0 · Test Files 899 passed | 1 skipped · Tests 6641 passed | 15 skipped
```
