# CLOSURE - keep voices apart

## What is true now (in the repo; 0270 not applied, website and app not shipped)

A recorded-audio read keeps which voice said each line, and a call with two unassigned voices is answered by naming
the rep's voice, on the web and in the app, as a new version.

## Residual

```json
[
  {
    "id": "R1-0270-not-applied",
    "item": "0270 is not applied; the website reads speaker_cluster through the view and must not deploy before it.",
    "why_skipped": "A production migration needs the founder's go-ahead.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-08T13:45:00Z",
    "outcome": "OPEN."
  },
  {
    "id": "R2-two-calls-have-no-voices",
    "item": "cef6995b and 8bde1ce2 were saved before 0270 with no voice ids; they need one more re-read to be asked per voice.",
    "why_skipped": "Needs 0270 live and two speech-to-text runs.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-10-08T13:45:00Z",
    "outcome": "OPEN."
  },
  {
    "id": "R3-card-render-untested",
    "item": "The web two-voice card has no render test: it is a non-exported component in a Next page file.",
    "why_skipped": "Its decision is the tested transcriptVoices and the route is tested; extracting the component is a refactor of its own.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-10-08T13:45:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Residual update (appended 2026-10-08T14:05Z)

- **R1-0270-not-applied: CLOSED.** `db-apply --verify` passed (rolled back) 13:42:47Z; `db:apply` 13:42:52Z, all 30
  live invariants hold; website 76e4ec4 live 13:45:38Z, 0 5xx after, post-deploy smoke passed; the view carries
  speaker_cluster and assign_session_voices exists (production, read-only).
- **R3-card-render-untested: CLOSED.** The card moved to its own component; three render tests (two voices: a line
  from each and `{ agentCluster }`; "None of these is me"; one voice: `{ mine: true }`). Disabling the two-voice
  branch fails 2 of them.
- **R2-two-calls-have-no-voices: CLOSED.** Markers reset on exactly the 2 (one transaction, 13:46:47Z); the 14:20
  recovery run re-read both: version 3, every line with a voice id, 0 without. The diarizer found 3 voices on each
  (asked for 2): 8bde1ce2 speaker_0 23 lines / 69 words, speaker_1 4 / 8, speaker_2 19 / 25; cef6995b speaker_1
  1 / 3, speaker_2 13 / 67, speaker_3 12 / 22. The question lists every voice; the one picked becomes the rep and
  the rest the customer. Both calls now wait only on the rep's answer.
- App build 31 (EAS 003ff068, from d605af66) finished 13:57Z; submission 4fcd7873 finished.

## Why the 5 meetings were left out (appended 2026-10-08T16:00Z)

On 2026-10-03 the stuck set was cut from 12 to 7 by calling 5 all-'unknown' meeting transcripts "normal", on a count
alone. The reason, now read: the meeting review does not use stored labels. `meeting-session/[id]/dissect/route.ts`
re-transcribes the audio with diarization and takes `speaker: s.speakerId` straight from it (lines 112-113), so a
meeting's stored 'unknown' lines change nothing in its review. Not a defect.
