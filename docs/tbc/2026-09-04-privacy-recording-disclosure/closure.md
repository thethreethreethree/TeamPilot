# CLOSURE — the privacy policy says what happens to a recording

## What shipped

`elostate.com/privacy` now describes the thing the product actually does that is most sensitive: it records sales
conversations.

Three changes, and the second and third were not what I came for:

1. **A new section** — recording is user-initiated, the other party is audible, the representative and their
   managers can hear it and nobody else can, and what gets derived from it.
2. **A sentence corrected.** The Anthropic entry claimed *"we do not send any data through Anthropic that you
   haven't already authored in the product"*. A conversation transcript contains what the prospect said, and the
   prospect authored nothing here. That is an assertion, not an omission, and the kind a reader relies on.
3. **Three undisclosed processors added**, not one. ElevenLabs receives the audio. Postmark carries names, points
   and deal counts in every weekly digest. Sentry receives error reports wherever it is enabled.

## Checks — commands, not moods (§3.2.3 / A38)

The canonical gate is pasted in check.md with its exit code. There is no unit test for "a document is true", so
each claim the new text makes is traced in check.md to the code that makes it true — including the one number I
first wrote from memory, which was wrong and was recounted with `grep`.

```
  Theme-bound leaks: 0
  Missing policies:      0
  Violations:            0
  tbc:docs tbc:manifest tbc:artifacts tbc:residual tbc:freshness — all OK
 Test Files  616 passed | 1 skipped (617)
      Tests  4049 passed | 15 skipped (4064)
exit: 0
```

## The un-named reliance

- Relies on ElevenLabs remaining the transcription provider. `elevenlabs.ts`'s own header notes the provider choice
  is deliberately swappable; if it is swapped, this policy names the wrong company.
- Relies on Postmark remaining the email sender — `outbound.ts` says the same, "Postmark today, others later".
- The Sentry entry is written to be true whether or not it is switched on, because production environment variables
  are not readable from here.
- Relies on the RLS policies in migration 0242 continuing to be what decides who can hear a recording. The policy
  says the database enforces it, which is a stronger claim than "the screen does" and stays true only while that
  is where the check lives.

## Residual (§4 / A36 — read from the top of the confidence ranking)

```json
[
  {
    "id": "R-2026-09-04-12",
    "item": "Whether the TERMS page has the same gap as the privacy policy — silent about recording.",
    "why_skipped": "Felt like a different document with a different job: terms are obligations, the privacy policy is disclosure, and I had just fixed the disclosure.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-04T07:14:00+08:00",
    "outcome": "Opened because the confidence was high, and it was NOT clean. src/app/terms/page.tsx uses 'record' four times and every one means an event record — exactly the same pattern as the privacy policy, and it says nothing about recording conversations. It matters MORE there than I assumed: the terms are where a representative's obligation to record lawfully where they work would live, and that obligation is currently written nowhere. NOT fixed in this build, deliberately: drafting an obligation clause that binds a user is a lawyer's job in a way that 'here is what our system does' is not. Raised to the owner as its own decision rather than absorbed into a build about disclosure."
  },
  {
    "id": "R-2026-09-04-13",
    "item": "Audio retention period and whether a representative can delete their own recording.",
    "why_skipped": "Not stated anywhere in the repository, and inventing it would put a promise the business has not made into a document people rely on.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": null
  },
  {
    "id": "R-2026-09-04-14",
    "item": "The rendered page, read in a browser as a person would.",
    "why_skipped": "JSX inside the file's existing Section component; typecheck and lint clean.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": null
  }
]
```

## For the owner

Branch `privacy-recording-disclosure`, off `main`, nothing merged.

**Two things need you, not me:**

1. **How long is a recording kept, and can a rep delete one themselves?** Deliberately left unwritten — see
   remediate.md. Tell me and I will write it.
2. **The Terms page says nothing about recording either**, and that is where a representative's obligation to
   record lawfully would belong. Different document, different job, and an obligation clause is a lawyer's to
   draft. Flagged rather than written.

And the standing one: this file has said `NEEDS LAWYER REVIEW` since v0.1. This build makes the document describe
the system. It does not make it compliant, and nobody should read these notes as saying otherwise.
