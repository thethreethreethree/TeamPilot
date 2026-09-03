# CHECK — the privacy policy says what happens to a recording

Audited against the built file and against the code it describes (§3.3.1). The whole policy was read, including the
sections not being changed — which is how the false Anthropic sentence and the two extra processors were found.

## Canonical gate — `npm run check`

```
  Theme-bound leaks: 0
  Missing policies:      0
  Violations:            0
  tbc:docs tbc:manifest tbc:artifacts tbc:residual tbc:freshness — all OK
 Test Files  616 passed | 1 skipped (617)
      Tests  4049 passed | 15 skipped (4064)
exit: 0
```

## What could not be checked by a test, and how it was checked instead

There is no unit test for "a document is true". Each claim the new text makes was traced to the code that makes it
true:

| The policy now says | Verified by reading |
| --- | --- |
| Recording starts only when a person presses record | `record.tsx:347` — `allowsRecording: true` is set at start, not on mount |
| The other party's voice is in the recording | inherent; the audio is one microphone in one conversation |
| Rep and their managers can hear it; peers and other companies cannot | migration 0242's RLS policies, and `points-api.ts`'s note that the policy — not the client — decides |
| A transcript, a score and coaching notes are derived | `transcribeWithDiarization`, then `dissectCoachV5` |
| ElevenLabs receives the audio | `elevenlabs.ts`, imported by 4 call sites in the sales-session path |
| Anthropic receives the transcript | `dissectCoachV5` in the coaching-material and dissect routes |
| Postmark handles digest email content | `outbound.ts:48` — `https://api.postmarkapp.com/email`, called by `weeklyDigest.ts:161` |
| Sentry receives error reports where enabled | `next.config.ts` `withSentryConfig`, DSN-gated |

## Cross-module pass (§3.3.2 / A21)

The concept is "a third party that receives our users' data". Inventoried from the code, then checked against the
policy's list — in that direction, because the reverse direction only ever confirms what is already written.

```
grep -rlnE "anthropic|elevenlabs|openai|deepgram|postmark|sentry" src/lib --include=*.ts -i
```

| Processor | In the policy before | Now |
| --- | --- | --- |
| Supabase | yes | unchanged |
| Vercel | yes | unchanged |
| Anthropic | yes, with a claim that had become false | corrected |
| **ElevenLabs** | **no** | added |
| **Postmark** | **no** | added |
| **Sentry** | **no** | added, worded to be true whether or not it is enabled |

## Findings

### F1 — the policy never mentions the recording

class: a document that describes the system, left behind when the system grew.
sweep: read `src/app/privacy/page.tsx` end to end; `grep -oic record` returns 23 hits, every one meaning a record
  of events.
severity: high — Apple cross-checks the App Privacy declaration against this page, and beyond Apple it is the only
  document the recorded party could consult.

Fixed: a new section covering what is captured, that it is user-initiated, that the other party is audible, who can
hear it, and what is derived.

### F2 — a sentence in the policy had become false

class: a true statement that a later feature falsified, left in place because nobody re-read it.
sweep: read every sentence in "Third-party services we use" against what the code sends. One instance.
severity: high — it is not an omission but an assertion, and it is the kind a reader would rely on.

*"We do not send any data through Anthropic that you haven't already authored in the product."* A conversation
transcript contains what the prospect said, and the prospect authored nothing here. Corrected rather than deleted:
the claim still holds for the rest of the product, and removing it would drop a true reassurance to hide one
exception.

### F3 — three processors were undisclosed, not one

class: same as F1 — the document drifting from the system — but found by sweeping the class rather than by looking
  at the thing that prompted the build.
sweep: the grep above, over `src/lib`, then each hit checked for a live call site.
severity: high for ElevenLabs (audio of two people), medium for Postmark (names, points and deals by email), low
  for Sentry (gated, and scrubbed before sending).

**This is the finding I would have missed by fixing only what I came for.** I opened this build to add a recording
section. Asking "what else does this document not name" turned up two more, one of which handles personal data on
every weekly send.

Verified adversarially rather than counted: Postmark has a real endpoint constant and a caller in `weeklyDigest.ts`;
Sentry is wired in `next.config.ts` but DSN-gated, so its entry is written to be accurate whether or not it is
switched on — I cannot read production environment variables and did not pretend to.

## Inspected and NOT clean-billed (§3.3.5)

Inspected: the whole policy, the recording path, the RLS policies it describes, all four ElevenLabs call sites, the
Postmark sender and its digest caller, and the Sentry wiring.

**Not inspected, and not claimed:**

- **The rendered page.** Typecheck and lint are clean; nobody has looked at it in a browser.
- **Whether the text is legally sufficient.** The file's own header has demanded a lawyer since v0.1 and this build
  does not discharge that. It makes the document match the system; whether that satisfies GDPR, CCPA or two-party
  consent law is a question this build does not answer.
- **The audio retention period and self-service deletion** — deliberately unwritten. See remediate.md.
