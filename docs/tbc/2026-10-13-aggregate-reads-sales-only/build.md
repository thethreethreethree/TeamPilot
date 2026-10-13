# BUILD - aggregate reads of sales reviews leave meetings out

### One lookup for the subjects to leave out

- **write-path:** `src/lib/coach/v5/nonSalesSubjects.ts` (`nonSalesSubjects`, `subjectsNotIn`).
- **read-path:** `src/lib/coach/v5/__tests__/nonSalesSubjects.test.ts` (kinds match isSalesCall; scope; null on error; never-empty list).

### Both aggregate routes use it

- **write-path:** `src/app/api/coach/sales-session/my-training/route.ts`, `coach-assessment/route.ts`
  (`.not("subject", "in", ...)` on the dissect count and content reads; degrade on a failed lookup).
- **read-path:** `my-training/__tests__/route.test.ts` (new; meetings left out, degrade on error);
  `coach-assessment/__tests__/route.test.ts` (unchanged; its result is in check.md); INVARIANT 34.
