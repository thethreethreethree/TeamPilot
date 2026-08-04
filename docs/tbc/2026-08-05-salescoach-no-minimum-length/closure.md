# CLOSURE — Sales Coach: no minimum length, every session gets all content

## What shipped
Every Sales Coach content engine now generates its full output for EVERY session regardless of length —
"Your read", all score categories, Dissect, Summarize, moments, pivot, and why. The sales agent's real
5–7 minute pitches (reproduced 4×) will no longer render as "This call was too short to read yet" with
only 2 scores. Two layers were changed: the LLM prompt refusals (`return hasSignal:false if too thin`)
were flipped to always-generate-but-still-grounded, and the engine length floors
(`MIN_AGENT_SEGMENTS`/`MIN_SEGMENTS` = 3/4) were lowered to 1 (a genuine-empty floor only).

## Un-named reliance (not self-evident)
- **"Always generate" is NOT "fabricate".** The prompts still hard-forbid invented quotes/statistics and
  require every point to be grounded in a real transcript line. The correct mental model is: a short call
  gets a short REAL read, never a manufactured lesson. Do not "simplify" the prompts by dropping the
  grounding rules — that would trade the founder's honesty moat (§3.4) for empty filler.
- **The floor is 1, not 0, on purpose.** A session with literally zero rep turns (a one-sided capture) or
  zero segments still returns the honest empty state — there is no rep behaviour to read. This mirrors the
  existing talk-ratio capture-gap caveat (`custW===0`). Setting the floor to 0 would ask the LLM to read a
  rep who said nothing.
- **No page edit was needed, and that is intentional.** `after-pitch/page.tsx` renders content by
  `.length`/`hasSignal`; its "too short" and "no conversation captured" gates are satisfied automatically
  once the engines return content. If a rep still sees an empty state on a given call, it is now a genuine
  0-turn/0-segment capture gap — not a length threshold.
- **Live and cross-session engines were deliberately left alone.** `liveCue`/`liveConfidence` (real-time
  in-call) and `salesWhyPatterns` (multi-session aggregate) have their own minimums for real reasons
  (delta comparison / statistical aggregate), not "minimum time" on a finished call. See check.md's sweep.

## Flagged, not fixed (§3.3)
- None new. (The separately-tracked transcript-collision item in the founder queue is a data issue and is
  unaffected by this change.)

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No live end-to-end screenshot of a real short call rendering full content.", "why_skipped": "The After-Pitch screen is owner-private (RLS) and needs real recorded call data; it cannot be headlessly captured. Proven at the engine/prompt layer + an updated test asserting a 2-turn call now generates a read.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-04T22:09:11Z", "outcome": "OPENED — verify with the sales agent on their next short pitch; tsc/vitest/build all exit 0." },
  { "id": "RES-02", "item": "salesIntel prompt not audited for a separate too-thin refusal (only its engine floor was lowered).", "why_skipped": "salesIntel is a secondary extraction surface, not one of the founder's named surfaces (read/summarize/dissect/scores); its engine floor was the length gate. If intel is still sparse on a short call, re-check its prompt.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-04T22:09:11Z", "outcome": null }
]
```
