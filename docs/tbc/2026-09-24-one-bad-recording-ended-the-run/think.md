# THINK — the drain died on its first real run

started_at: 2026-09-24T11:05:00Z

## The report

The founder sent a screenshot of the live Coach Assessment page:

> **194 recordings have never been scored**
> Until a pitch is scored it appears on no dashboard — not the rep's, not the team's, not
> Recordings. Scoring is one AI grading call per recording.
> [Score them all]
> **Scoring stopped because the request failed. Nothing already scored is lost.**

Beside it, the partner's WhatsApp from 11:41: *"It's looking good!"* / *"Once it updates with past
recordings I'll be able to have some morne geedback"* — he is waiting on exactly this.

## What the screenshot rules out, before any code was read

The count rendered. **194 is a real number from the GET**, and `GET` and `POST` run the same
`gate()` — the same auth, the same company resolution, the same `isSalesCoachManager`. So a 401 or
403 on the POST is impossible: the gate that would have refused it already passed a few
milliseconds earlier to produce the number on screen.

That eliminated the whole class of permission causes from the picture itself, which is why the
diagnosis went straight to the loop.

## The diagnosis

Three defects, all mine, all in code I shipped this morning.

**1. `scoreSession` had no top-level try/catch.** Only the pattern-detection side effect at :188
was wrapped. `getSession`, the existing-score read, `getSessionTranscript`, `generatePitchScore`
(the LLM call) and `storePitchScore` could all throw straight out.

**2. The drain called it in a bare loop.** One throw propagated out of the `for`, out of the POST,
into a 500. **One malformed recording in 194 ended the entire run.** With `BATCH = 8` a full drain
needs ~25 consecutive clean passes; the chance that all 194 recordings have a readable transcript,
a parseable LLM response and no rate limit is not high.

**3. The panel discarded the evidence.** `if (!res.ok)` printed a fixed sentence and threw away
both `res.status` and the body — and the route returns `{ error }` on every failure path. The
one screen that could have said what happened said nothing instead.

And a fourth, found while fixing the first three: **`slice(0, BATCH)` on a list that never
empties.** A huddle is never scored, so it stays in `candidates` on every read. The original guard
against re-attacking it forever was `more: scored > 0` — which terminates, but also reports "done"
with everything unscored if the oldest eight recordings happen to be huddles.

## What I cannot determine from here

**Which recording threw.** I do not have the production logs. That is the point of fix 3: after
this deploys, the screen says it instead of me inferring it.
