# REMEDIATE — "Your read" starvation recovery + remove the length cap

## F1 — retry leaner on an empty read
Remediation: `generateSalesReview` retries on an empty/no-signal response with the LEAN built-in prompt (no
company corpus/product) — cutting the biggest reasoning driver so deepseek-v4's ~8k output budget isn't consumed
by reasoning before the answer. The transcript is unchanged, so a real read comes through; both misses are still
logged (INV22). Only when both attempts starve does the honest empty survive.
gate-or-promise: gate. `salesReview.generate.test.ts` locks: first empty → leaner retry returns the read (2
debrief calls); both empty → honest empty + a loud log each time. Removing the retry reddens CI.
class: reasoning-model-token-starvation / error-dressed-as-no-data. severity: high. Fixed.

## F2 — remove the "very short exchange" length excuse
Remediation: the after-pitch blank-narrative fallback no longer says "a very short exchange may not have enough to
write a full read"; it says the read is being rebuilt, points at the real scores/focus feedback, and offers
Rebuild. Aligns with the standing no-minimum-length rule.
gate-or-promise: promise. UI copy in a client page (repo has 0 `*.test.tsx`); verified by the grep sweep-command
in check.md (0 remaining "very short / not have enough" in product copy) + a visual check.
class: honesty / false-cause. severity: medium. Fixed.

## Deferred (flagged)
- salesDissect shares the starvation shape — apply the same retry (follow-up).
