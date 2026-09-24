# CHECK

## Commands

```
$ npx tsc --noEmit -p tsconfig.json                          → exit 0
$ npm run build:ci                                           → "✅ Secretless build PASSED"
$ npx vitest run …/pitch-score/backfill/__tests__/route.test.ts → 16 passed
$ npx vitest run …/pitchScore/__tests__/scoreSession.test.ts    → 6 passed
$ npm run check                                              → see closure
```

## Findings

### One throwing recording ended the whole run

class: an authority that returns a verdict for its decisions and an exception for everything else
sweep: `grep -nE "try \{|catch" scoreSession.ts` → one try/catch, around the pattern-detection side effect only
severity: **critical — this is live and a partner is blocked on it**

**[OBSERVED]** `scoreSession` wrapped `runDetection` at :188 and nothing else. `getSession`,
`getSessionTranscript`, `generatePitchScore` and `storePitchScore` were all unguarded.

**[OBSERVED]** The drain's loop has no try/catch, so the exception reached the POST handler.

**[OBSERVED]** The panel's `!res.ok` branch prints a fixed sentence and discards `res.status` and
the body.

**[INFERRED]** A single malformed recording among the 194 produced the 500 the founder
photographed. I cannot name which one — I have no access to the production logs, and that is
exactly the gap fix 3 closes.

### The drain could not get past an unscorable recording

class: paging with `slice(0, N)` over a list whose head never leaves
severity: high

**[OBSERVED]** A huddle is refused, never scored, and so appears in `unscoredSessionIds` on every
subsequent read.

**[OBSERVED]** The existing guard was `more: scored > 0`, which terminates but reports the backlog
finished when the first batch happens to be unscorable.

**[OBSERVED]** My first replacement — `more: attempted > 0` — would have looped forever re-billing
the same eight gradings. Caught by working through the arithmetic before running it. **Recorded
because it was the more expensive of the two bugs and it was mine, twice in one sitting.**

### What the screenshot ruled out on its own

**[OBSERVED]** The count "194" rendered, and `GET` and `POST` share `gate()`. A 401/403 on the POST
is therefore impossible — the same gate passed moments earlier to produce the number.

Worth writing down as method: **the evidence eliminated a whole class of causes before any code was
read.** A screenshot is not just a symptom; it is a set of things that must have worked.

## What this does not prove

**It has not been run against the real backlog.** Everything here is verified by tests with injected
failures and a green build. The claim "press the button and it drains" is **[INFERRED]** and stays
inferred until the founder presses it. The one thing I can promise is that a failure will now name
itself on screen.

**I do not know which recording threw**, or whether more than one will. If many of the 194 are
huddles or have no rep speech, the drain will now walk past them and say so per reason, rather than
stopping.

**Nothing about the other errors the founder reported.** I have evidence for this one only, and
asked rather than guessed.
