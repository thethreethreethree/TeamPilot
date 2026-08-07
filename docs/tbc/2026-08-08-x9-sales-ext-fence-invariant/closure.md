# CLOSURE — INVARIANT 24: fence the extension engines against LLM prompt injection

## What shipped
A new build-time invariant (INV24) that enforces the CONVERSATION_IS_DATA prompt-injection fence on the Sales
Coach extension's text-in LLM engines — the shape INV23 (segments-based) structurally could not see. Six
self-tests + a live strip-test proof. No product code changed: all 5 engines already comply.

## Un-named reliance (not self-evident)
- **This is the THIRD instance of one class:** an invariant whose SCOPE did not grow when a parallel surface
  appeared. INV8 + INV18 (auth) were widened earlier today to cover coach/extension; INV24 covers the fence
  for the text-in engine SHAPE that INV23's segments-trigger misses. The lesson: when you add a parallel
  namespace or a new engine shape, audit whether the EXISTING guards' triggers actually reach it — a guard
  that silently stops covering new code is worse than a visible gap.
- **The trigger is intentionally the LLM-caller reference, not the fence's absence alone.** A file under
  coach/extension/ that references dissectCoachV5/generateCareReply IS sending external text to a model; that
  is the precise "must fence" condition. A pure types/util file there (no LLM caller) is correctly ignored.
- **Reuses INV23's TRANSCRIPT_FENCE_RE.** One fence primitive (CONVERSATION_IS_DATA), one regex — do not
  define a second. If the fence constant is ever renamed, update the one regex.
- **EXT_FENCE_ALLOWLIST is empty ON PURPOSE.** Today every extension LLM engine injects external conversation,
  so none is exempt. A future engine that injects only non-external text (none exists yet) would be the first
  allowlist entry, WITH its reason — never silently.

## Flagged, not fixed (§3.3)
- None. This closes a detection gap; there is no deferred remainder.

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "The scope-gap class (an invariant whose trigger doesn't track a new namespace/shape) has now recurred 3x (INV8, INV18, INV23→INV24). No meta-guard checks that every extension namespace is covered by every relevant invariant.", "why_skipped": "A meta-guard over the audit's own coverage is a larger design question (how to assert 'every invariant that should cover coach/extension does') and risks over-abstraction; the concrete three instances are fixed. Worth watching whether a 4th instance appears before building a meta-check.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-08T05:24:00Z", "outcome": "OPENED — if a 4th scope-gap instance appears, consider a coverage meta-guard; until then, the pattern is documented here + in the INV24 comment." }
]
```
