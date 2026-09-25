# CLOSURE — the panel that runs at the door

## What is true now

The live-call panel has a card on cream. Its status chips stay whole and stay inside it. The
not-recording banner and the transcript-recovery path have been photographed for the first time.

`/[id]`'s render tree is **0**, down from 24. `/doors` is **0**, down from 11. Sales Coach is at
**45 across 14 files**, down from 80.

## Why this instead of the bigger route

`/team`'s tree held 18 sites and this panel held 2. I took the 2.

The previous closure called this component "fixed by pattern and still unseen, which is precisely
the category this session keeps promising to stop shipping." Writing that sentence and then going
after the yield would have made it decorative. It is also the only screen in the product whose
defects cost a live conversation instead of a browsing session.

## What the fix pass got wrong, twice, in one file

**I swept a tree and then fixed files.** The render-tree sweep named this component's two sites an
hour before. When I "fixed `/[id]`" I patched the two files I had rendered, left the third, and
wrote a closure reporting both files at zero. Both files were. The route was not. Having just
established that the tree is the unit of MEASUREMENT, I reverted to the file as the unit of REPAIR.

**And the header fix made things worse before it made them better.** `whitespace-nowrap` on the
chips was the right instinct — "OBJECTION (LAST READ)" must not split after "LAST" — and alone it
turned a bad line break into `signal` clipped off the card's right edge. Atomic units need
somewhere to wrap to. Three passes, each about ninety seconds, and only the second pass's picture
could have told me the second pass was wrong.

## And a capture of mine that passed while photographing the wrong screen

The second state was meant to be "the mic died mid-pitch". I set `audioCapturing: false` against a
**live** socket; the banner is gated on `!live`, so it could not render. The matcher
`/audio|mic|recording/i` passed anyway — on **"MIC LEVEL"**, which is chrome present in every
state.

Eighth vacuous wait of the session, written in the same file whose docstring warns about them. The
wording needed sharpening, so: **the wait token must be a string that exists ONLY in the state
being photographed**, and the test of a matcher is not "does it pass" but **"would it fail if the
feature were absent?"**

## Residual

```json
[
  {
    "id": "R1-45-remain-and-the-next-two-routes-hold-25",
    "item": "kpi/page.tsx 7, team/page.tsx 6, AddAgentDialog 6, TeamPasswordsDialog 6, VoiceEnrollment 5, then nine files with 1-2.",
    "why_skipped": "One route at a time.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-25T03:25:35Z",
    "outcome": "OPEN. `/team`'s tree is 18 of the 45 (its page plus the two dialogs) and `/kpi` is 7. Those two routes are more than half of what is left."
  },
  {
    "id": "R2-the-captureStalled-warning-is-still-unseen",
    "item": "`LiveCoachingPanel:404` renders '⚠ The mic stopped — audio isn't recording' when a live session produces no turns for a timeout. It is the panel's loudest moment and no fixture here reaches it.",
    "why_skipped": "It is gated on a timer plus an empty transcript; producing it needs fake timers.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T03:25:35Z",
    "outcome": "OPEN, and it is the highest-consequence sentence this component can say — a rep mid-pitch whose audio is not being captured. Its colours were mode-split in this build and it has never been rendered."
  },
  {
    "id": "R3-the-control-row-wraps-every-label-to-three-lines",
    "item": "At the real 448px width, Mode / Suggestion / Guide my response / I'm speaking / Auto-coach ON / Coach me now each wrap to three lines. Nothing is clipped; everything is readable.",
    "why_skipped": "Re-laying out the live control row is a design decision, not a colour fix.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T03:25:35Z",
    "outcome": "OPEN, for the founder. Six controls in a 448px column on the screen a rep glances at one-handed mid-conversation. §2 'surface, don't overtake' applies most where the change would be easy to justify afterwards."
  },
  {
    "id": "R4-the-error-sentence-prints-twice",
    "item": "In the not-recording state the same sentence appears as the banner body and again inline below.",
    "why_skipped": "A content judgement.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-25T03:25:35Z",
    "outcome": "OPEN and cosmetic. Recorded because it is visible in the capture and would otherwise read as something I did not notice."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Six captures plus six crops were generated from this project's own components into
`artifacts/visual/` (git-ignored) and each was opened and described.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp
JPEGs, three Sales Coach routes, two of DoorLog's four states, `RepActivity`, and the
`captureStalled` warning named in R2.
