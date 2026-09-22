# BUILD — the Recordings tab

## What was built

Guide Step 4, all seven items, plus the clause after the comma in item 6 that makes it a feature
rather than a row.

| # | The guide | Where it landed |
|---|---|---|
| 1 | Recording list — date, length, outcome, Pitch Score, pattern moments, "Not counted" | `readPitchRecordings()`, rendered by `RecordingsTab` |
| 2 | Player — waveform, play/pause, −10s / +10s, 1x / 1.25x / 1.5x / 2x | `RecordingsTab` → `Player`, peaks from `peaks.ts` |
| 3 | Timeline markers, four colours, click to seek | `keyMoments()` → `MarkerStrip` |
| 4 | Key moments list with timestamp and points | the same array, rendered again by `KeyMoments` |
| 5 | Transcript at the playhead, flagged line highlighted | `timedLines()` + `linesAround()` → `Transcript` |
| 6 | Comment at a timestamp; "Save and send to rep" notifies and shows in their Pitch detail | `0259`, `/pitch-recordings/comment`, `notifyRecordingEvent`, **and `ManagerComments` inside `PitchDetail`** |
| 7 | "Save as team example" needs the rep's permission | `0260`, `shareState()`, `/pitch-recordings/share` |

## The three decisions that were not obvious

### 1. The waveform is decoded or it is absent

Every cheap way to draw one — a seeded random bar strip, a sine, a gradient — draws a picture of
audio that is not this audio, positioned under markers a manager clicks to jump to a specific
second. It would look exactly like the real thing.

This is the one screen in the product whose entire job is to let a human check the machine (§3.3,
A11). So `peaks.ts` decodes the file with `decodeAudioData` and buckets real max-abs samples, and
every failure path — CORS, codec, size, abort — returns `unavailable` with a reason. The surface
then renders a plain seek track with the markers still on it and says why. A plain track is a
smaller feature; a fake waveform is a lie.

### 2. "Save as team example" is an append-only consent log, not a boolean

A `shared_as_example boolean` is a manager-side switch, which is what the guide forbids and what
A10 forbids more strongly — this is not a shadow read, it is other people hearing a recording of
someone. A boolean also cannot answer the question that matters later: *was she asked, and what
did she say.* Granting and never having been asked look identical in one column.

`recording_share_events` (0260) holds four kinds and the state is replayed by `shareState()`. The
asymmetry is in the **policies**, not the route: a manager may only append `requested` (service-role,
no client policy), and only the rep whose pitch it is may append `granted` / `declined` / `revoked`
(`actor_id = auth.uid()` AND `p.rep_id = auth.uid()`). A route is one deploy away from being the
only thing between a manager and a recording of somebody else.

The rule that took the most thought: **a later request does not reopen a grant, and does not clear a
revocation.** A manager who asks twice must not be able to read the second "pending" as consent.
`shareState` keeps the last answer governing playback while showing the live question — and there
is a test for each direction.

### 3. The transcript reads `coaching_transcript_segments`, not `pitch_scores.transcript`

The founder ruled "add timed transcript segments to the schema first." The schema already had them
— `speaker`, `text`, `seq`, `spoken_at` — and `pitch_scores.transcript` is a flattened copy. So the
ruling is satisfied by reading what exists. That is the **fifth** time in this build cycle the guide
named something the product already had under a different name.

`timedLines()` converts the wall clock to an offset from `recorded_at`; a segment with no clock
keeps `atSeconds: null` for the same reason a marker does, and `linesAround()` will show an untimed
line in the window but never focus it. Ordering is by `seq`, never by time, because two segments can
share a `spoken_at` and a transcript reordered by timestamp reads as a different conversation.

## The mistake this build made, on the record

**I overwrote a live route.** `src/app/api/coach/sales-session/recordings/route.ts` already existed
— the Sessions tab's call-audio list, `?agentId`-gated, with its own tested manager check and a
`CORRECTION (2026-07-17)` note in its header. I wrote my new pitch-recordings route straight over it
with `cat >`.

This is A21 exactly (same name, different feature, across modules) and it is worse than the previous
instances, because the earlier ones were *names I was about to duplicate* and this one was a file I
destroyed. It was caught by **that route's own test file**, not by me, six steps after the fact.

What it cost and what closed it:

- Restored from `HEAD`; the new route moved to `/api/coach/sales-session/pitch-recordings`.
- `readRecordings.ts` renamed its exports to `PitchRecordingRow` / `PitchRecordingDetail` /
  `readPitchRecordings` / `readPitchRecordingDetail`, because the other route declares a local
  `RecordingRow` meaning a coaching session.
- Rate-limit ids split (`coach-pitch-recordings`), or the two features would have shared a bucket.

The generalisable lesson, which is NOT "be careful": **`cat > path` on a path I have not read is an
unconditional destructive write, and nothing in the gate can see it** — typecheck, lint and the
audits all pass on a file that replaced another file. The check that found it was a pre-existing
test. `git status` showed ` M` rather than `??` immediately after the write and I did not look.

## Four-layer trace (§1.5.1)

**1 — Structure.** Reads in `src/lib/coach/recordings/`, pure derivations separated from IO:
`keyMoments`, `shareState` and `bucketPeaks` are all pure and all tested without a database or an
`AudioContext`. The routes hold auth and IO only.

**2 — Effectivity.** All seven items work end-to-end against real tables. Item 6's second half —
the rep actually seeing the comment — is built, which is the difference between this and the A31
seam the think.md predicted.

**3 — Composition.** The tab opens the newest recording automatically, so a manager who clicked
"Recordings" is already listening rather than facing an empty panel. "Adjust score" links to the
existing dispute queue rather than opening a second write path to `pitch_score_overrides`. A
comment sent to a rep lands in their bell AND in their Pitch detail, so the manager's next move —
expecting a reply — is possible.

**4 — Surface.** Built from the board as read: the two-column layout, the four-colour legend in its
words, "Not counted", the transport row, KEY MOMENTS, TRANSCRIPT AT <time>, and the three buttons in
the board's order.

## Not opened

No image, icon or graphic asset was created, edited, moved or restyled in this build. The board PDF
that specifies this screen (`Coach Assessment  Recordings tab open (web).pdf`) was opened and
described on 2026-09-22 and is recorded at line 31 of
`docs/SYSTEM UPDATES AND REVISION 09-22-2026/EVIDENCE.md`.
