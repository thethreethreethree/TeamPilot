# CHECK — "Your read" starvation recovery + remove the length cap

## Verification run (A38)
Canonical command: `npm run check`. Full-gate output + exit code in closure.md.

## Findings

### F1 — "Your read" comes back EMPTY on a longer / large-corpus call (reasoning-model token starvation)
file+line: `src/lib/coach/v5/salesReview.ts` `generateSalesReview` → `debriefCoachV5` (deepseek-v4, ~8k output
ceiling; reasoning_content counts against it).
class: reasoning-model-token-starvation / error-dressed-as-no-data (INV22) — a real two-sided call's written read
silently blank.
severity: high (the founder's 2-device test: a big-corpus company's 3-min call went blank; trust-critical — the
core deliverable didn't render).
sweep-command: `grep -n "runOnce\|STARVATION RECOVERY" src/lib/coach/v5/salesReview.ts` — the engine now retries
leaner on empty.
read-path: fixed — a starved first attempt is retried with the lean prompt (drops the corpus, the biggest
reasoning driver); the transcript is unchanged, so a real read comes through.

### F2 — the after-pitch fallback made a "very short exchange" length EXCUSE (a soft cap)
file+line: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` blank-narrative fallback.
class: honesty / false-cause (blamed "too short" when the real cause was starvation; contradicts the standing
"no minimum length, every call gets a read").
severity: medium (misleading surface on the exact failure the founder is chasing).
sweep-command: `grep -rn "very short\|not have enough" src/app/dashboard/sales-coach src/lib/coach/v5` — 0 in
product copy after this (only test/comment references remain).
read-path: fixed — the fallback now says the read is being rebuilt + points at the real feedback + Rebuild.

## Class sweep (A26)
Swept the "reasoning-model empty read" class: the REVIEW ("Your read") is fixed with the retry; the DISSECT
engine shares the shape and is flagged for the same retry (separate follow-up). The account investigation
confirmed the two test accounts are identical (admin + Standard) — NO per-account limitation, nothing to remove.

## Tests
```
$ npx vitest run salesReview.generate
 Test Files  1 passed (1)
 Tests  8 passed (8)
```
Locks the retry-recovery (first empty → leaner retry returns the read; both empty → honest empty + logged twice).
Full gate + exit code in closure.md.
