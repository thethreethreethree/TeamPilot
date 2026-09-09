# CHECK — capture the timing the speed metric needs, and read it as true tempo

## Findings
This build produced **no findings** as defects to fix — but it began by CORRECTING a wrong first diagnosis
(recorded honestly rather than hidden): my initial read was "no pace metric exists," overturned by searching
`skillAnalytics.ts` before building. Searching also surfaced the agentWpm throughput miscalibration, which was
raised to the founder and fixed in this same build rather than shipped.

## The gate bites (mutation, A38)
```
$ (mutate) skillAnalytics.ts agentWpm → old span-based throughput (words ÷ first-to-last span)
$ npx vitest run src/lib/coach/v5/__tests__/skillAnalytics.test.ts
 × REGRESSION: a long listen pause does NOT drag the tempo down (the throughput bug this fix removes)
 × computes the median speaking tempo from clean back-to-back turns
 × returns null with too few clean timed turns
      Tests  3 failed | 17 passed (20)
$ (restore)
      Tests  20 passed (20)
```
The mutation reintroduced the exact throughput bug; the regression guard named the user-facing consequence
(a good listener dragged toward "too slow"). Confirmed applied before reading the result, then restored.

## Persist-seam + flush guards
```
$ npx vitest run src/lib/coach/v5/__tests__/segmentFlush.test.ts \
                 src/app/api/coach/sales-session/[id]/segments/__tests__/route.test.ts
 Test Files  2 passed (2)
      Tests  13 passed (13)   # incl. spokenAt carried by selectUnflushedSegments + forwarded to appendTranscriptSegment
```

## Canonical command
```
$ npm run check
  typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test
  invariant audit: 0 violations
  tbc: docs · manifest · artifacts · residual · freshness — clean
  Test Files  625 passed | 1 skipped (626)
       Tests  4131 passed | 15 skipped (4146)
  Duration    70.70s
EXIT_CHECK=0
```
