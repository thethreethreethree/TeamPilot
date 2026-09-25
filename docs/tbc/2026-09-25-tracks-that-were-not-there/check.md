# CHECK — progress tracks that were not there, and three screens photographed for the first time

## Commands

```
$ npm run visual -- voiceEnrollment   → 1 passed; 2 images, opened as found and after
$ npm run visual -- todaysMetrics     → 2 passed; the Metrics page (Day + Custom), both themes
$ npm run visual -- pitchDetail       → 1 passed; 2 images, opened as found and after
$ npm run check                       → CHECK_EXIT=0, 5,530 passed, invariant violations 0
```

## VoiceEnrollment (Settings)

**[OBSERVED] as found, light** — mid-recording ("Listening…", 10/45 voiced): a yellow and a green bar
floating on nothing. No track, so nothing shows where "full" is — the one thing a progress bar says.
**[OBSERVED] dark** — both tracks present. Light-only.

Fixed: card → `bg-surface` (it sits directly on the page ground — its siblings in the account tab have
no card of their own); prompt box → `bg-surface-raised` (on the card); both tracks →
`bg-surface-raised`, the convention already used by `ui/deck.tsx:299`, marketing and finance; hover →
`hover:bg-surface-raised`.

**[OBSERVED] after** — light: white card on cream, grey prompt box on it, both tracks visible with the
fills a fraction of them. Dark: card clearly lifted, prompt box one step lighter, tracks present.

The recording state is driven for real: the audio mocks mirror the calls the component makes
(getUserMedia, `new AudioContext({sampleRate})`, createMediaStreamSource, createScriptProcessor,
createGain), and `onaudioprocess` is fed a 150 Hz sine so both fills stop PART-way — a full or empty
fill would hide a missing track.

## The same track in two more files

`doorlog/TodaysMetrics.tsx:202` and `doorlog/PitchDetail.tsx:135` carried the identical `bg-white/10`
track. Both theme-following (no fixed-dark ground). Fixed by pattern — and then both PHOTOGRAPHED,
because neither had ever been:

- **TodaysMetrics' Metrics page** — the pager's capture only ever shot its default Progress page (its
  wait names no Metrics-page string). Added a capture of the page itself in two states, because
  switching to Custom clears the data: Day (tiles + score chart) and Custom (the date inputs).
  Also fixed there: the date-input edges (`border-white/10` → `border-default`, fill kept — the
  `/team` dialog lesson) and the non-accent tiles (`border-default bg-surface`).
- **PitchDetail** — new capture. Also fixed: STRENGTHS `text-emerald-400` → split;
  GROWTH OPPORTUNITIES `text-ember-400` (bright yellow on cream) → `text-brand`; the failed-pitch notice
  `text-amber-400` → split (that state is unphotographed — fixed by pattern, unseen); the back link's
  `active:` press state (a still image cannot show a press).

**[OBSERVED] after** — Metrics page light: white bordered tiles, visible tracks, visible input edges;
dark: the same, nothing lost. PitchDetail light: tracks visible, STRENGTHS deep green, GROWTH
OPPORTUNITIES legible amber-brown; dark: mint and brand yellow, cards lifted.

## "Talk_listen" — a raw key on screen

PitchDetail printed score dimensions with `capitalize` on the database key, so a rep read
"Talk_listen". TodaysMetrics had a label map, privately. Moved `SCORE_ORDER` / `SCORE_LABEL` to
`src/lib/coach/doorlog/scoreLabels.ts` and both import it — one copy, so a new dimension cannot be
labelled in one screen and raw in the other (§2.2). **[OBSERVED]** PitchDetail now reads
"Talk / Listen". **[INFERRED]** TodaysMetrics unchanged: its re-render is byte-identical in size to the
one opened before the refactor.

## Two fixture errors, and a stale image, caught before they became findings

- **[OBSERVED]** The first Metrics-page shot drew Tone 8.1 as an 8% bar. `analyze.ts:34` holds the grader
  to 0-100, so the component's `width: val%` is right; the existing fixture used a 0-10 scale. Second
  unit error in test data today (the KPI capture fed fractions for percents). Both fixtures corrected,
  each with the unit named in a comment.
- **[OBSERVED]** `npm run visual -- a b` runs only the first filter. The todays-metrics PNGs I was about
  to open were from 18:31 the previous day. Caught by timestamp before describing yesterday's render as
  today's "after".

## Count

The broadest pattern (`(bg|border|divide)-white/`) finds **23** matches in Sales Coach outside the
shell. That is a count of SUSPECTS: the shell's 9 showed a match on a fixed-dark ground is correct, so
none of the 23 is a defect until its ground is read. It also includes four files earlier reported as 0
under narrower patterns — the same floor-vs-count lesson as this morning.

## Not opened

No image, icon, logo, favicon or graphic asset was touched. Not re-opened: the todays-metrics pager's
Progress page in dark (not changed by this work), and the todays-metrics-page-day pair after the label
refactor (byte-identical sizes; stated as INFERRED above).
