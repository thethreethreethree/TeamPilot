# BUILD - one verdict for "is this a sales call"

### isSalesCall defers to resolveCoachingMode

- **write-path:** `src/lib/coach/v5/salesOnly.ts`.
- **read-path:** `src/lib/coach/v5/__tests__/salesOnly.test.ts` (agreement on sales, meeting, huddle, null, undefined, "", unknown).

### Pitch scoring and the session page ask it

- **write-path:** `src/lib/coach/pitchScore/scoreSession.ts`; `src/app/dashboard/sales-coach/[id]/page.tsx`
  (Pitch Score `scorable`, and a meeting or huddle gets a link to `/dashboard/meeting-coach/[id]/review` in place of
  the sales tools).
- **read-path:** existing scoreSession tests (not_a_sales_call); INVARIANT 35 in `scripts/invariant-audit.mjs`.
