# BUILD — Sales-Coach area access gate as a pure, tested predicate

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## Change

### isSalesCoachMember predicate
`src/lib/coach/v5/skillAccess.ts` — added `isSalesCoachMember(caller: SkillViewer): boolean`, beside the
existing `isSalesCoachManager` and using the same `SkillViewer` shape.

- **write-path:** a pure function — no IO/persistence; the "write" is its return value
  `!!caller.sales_coach_role || caller.role ∈ {CEO,COO,admin}` (the "who may ENTER the Sales-Coach area"
  membership boolean). A doc comment records it is STRICTLY WIDER than `isSalesCoachManager` and why conflating
  them would lock staff reps out.
- **read-path:** exported from `skillAccess.ts`; its sole consumer is the sales-coach layout (below), and its
  behavior is read back by the unit tests. No other importer (A26 sweep).

### Layout routes through the predicate
`src/app/dashboard/sales-coach/layout.tsx` — the inline `isCompanyAdmin || hasSalesCoachRole` block is replaced
by a call to `isSalesCoachMember(...)`.

- **write-path:** the gate's effect — `redirect("/dashboard")` when `!member` — is unchanged; the SAME callers
  are redirected, in the same order relative to the module-lock resolution. Added the import + a comment on why
  the predicate is not inlined (future weakening must fail CI; mirrors `deriveCareAccess`).
- **read-path:** the layout reads `profile.role` + `profile.sales_coach_role` (unchanged `select`) and feeds
  them to the predicate (`company_id: null`, since membership is tenant-independent); the boolean decides entry.

### Regression test
`src/lib/coach/v5/__tests__/skillAccess.test.ts` — new `describe("isSalesCoachMember …")`.

- **write-path:** 4 asserting cases — admin|staff both members; CEO/COO/admin members; plain-member and null
  NOT members; and the pin that a staff rep is `member=true` / `manager=false`.
- **read-path:** imports `isSalesCoachMember` + `isSalesCoachManager` from `../skillAccess` and reads their
  outputs; the member⊋manager assertion reads BOTH so a future unify-the-gates edit fails here.

## Files
- `src/lib/coach/v5/skillAccess.ts`
- `src/app/dashboard/sales-coach/layout.tsx`
- `src/lib/coach/v5/__tests__/skillAccess.test.ts`
