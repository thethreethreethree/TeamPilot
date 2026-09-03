# BUILD — the privacy policy says what happens to a recording

Additive and narrow (§3.2.1). One new section, one new processor, one corrected sentence. The file's existing
`<Section>` component and its voice are matched rather than a second style introduced into a legal document.

### The recording section

- `src/app/privacy/page.tsx` — a new `<Section title="Recorded conversations (Sales Coach)">`, placed directly
  after "What we collect from you directly" and before "What the System derives about you", because it is a
  collection fact and belongs where a reader is already looking for one.

write-path: `record.tsx:347` — recording begins only when a representative presses record, with
  `allowsRecording: true` set at that moment rather than on mount, so the app does not hold the audio session for a
  screen somebody merely opened. That is the fact the section asserts, and it was read rather than assumed.
read-path: **`elostate.com/privacy`** — a published page, the URL given to Apple, readable by anyone including
  someone acting for the person who was recorded.

```json
{
  "feature": "the policy describes the recording, its processors, and who can hear it",
  "files": ["src/app/privacy/page.tsx"],
  "write_path": { "exists": true, "where": "record.tsx:347 — recording is user-initiated", "human_can_set": true },
  "read_path": { "exists": true, "where": "elostate.com/privacy", "human_can_see": true },
  "status": "BUILT"
}
```

### The undisclosed processors

- Added **ElevenLabs**, **Postmark** and **Sentry** to "Third-party services we use". ElevenLabs receives the audio
  of both speakers; Postmark carries names, points and deal counts in every weekly digest; Sentry receives error
  reports wherever it is enabled.

write-path: the code that sends. `elevenlabs.ts` (4 call sites in the sales-session path), `outbound.ts:48` posting
  to `https://api.postmarkapp.com/email` via `weeklyDigest.ts:161`, and `next.config.ts`'s `withSentryConfig`.
  A person sets this in motion by recording a call, or by a Monday cron reaching their manager's inbox.
read-path: the same published page — the list a reader consults to find out who handles their data.

Traced, not guessed: `transcribeWithDiarization` is imported by
`sales-session/[id]/retranscribe/route.ts:12` and `sales-session/[id]/auto-recover/route.ts:14`, and
`transcribeSpeech` by `coach/doorlog/worker.ts:5`, all from `src/lib/care/voice/elevenlabs.ts`. Four call sites in
the sales-session path. Zero mentions in the policy before this change (`git show main:… | grep -ci elevenlabs`).

### The sentence that had become false

write-path: `dissectCoachV5`, reached from the coaching-material and dissect routes with a conversation transcript
  as its input — which is what made the old sentence untrue.
read-path: the Anthropic bullet on the published page, which a reader would otherwise rely on as written.

The Anthropic entry read *"We do not send any data through Anthropic that you haven't already authored in the
product."* Corrected rather than deleted — the claim still holds for the rest of the product, and deleting it would
remove a true reassurance to hide one exception. The exception is now stated: a conversation transcript contains
what the other party said, and they authored nothing here.

## What was deliberately NOT written

**How long audio is kept, and whether a representative can delete a recording themselves.**

Neither could be read out of the repository. The existing "Retention and deletion" section is about the append-only
event chain, which is a different question from how long an audio file stays in storage.

A privacy policy is the wrong place to guess. An invented retention period is a promise the business has not made,
in a document people are entitled to rely on. Both are marked in the file's header comment and raised to the owner.

## Not a legal review

The file's own header has said `NEEDS LAWYER REVIEW` since v0.1, and this change does not discharge that. It makes
the document describe the system; whether the description satisfies GDPR, CCPA, two-party consent law or anything
else is not a question this build answers or claims to.

## UNTESTED

The rendered page. It is JSX inside the file's existing component, typecheck and lint are clean, but nobody has
looked at it in a browser.
