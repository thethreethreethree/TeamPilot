# BUILD — three iterations, each one caught by looking

### The panel had no card

- **write-path:** two `border border-white/[0.07] bg-white/[0.02]` → `border-default bg-surface`,
  at `:214` (the panel itself) and `:561`.
- **read-path:** `live-coaching`, both themes.

The outer `<section>` IS the card. On cream it had no edge, so the live-call surface bled into the
page with no boundary — the one screen where a rep needs to find a control without looking for it.

### The status chips broke mid-phrase, then overflowed, then fitted

Three passes, and the second was worse than the first:

1. **As found:** `LIVE · OBJECTION (LAST` / `READ) · SLOW + STEADY ·` / `signal` — the parenthetical
   split across lines. Reads as a rendering fault.
2. **After `whitespace-nowrap` on each chip:** the chips became atomic and the row could not wrap,
   so `signal` was **clipped off the card's right edge**. I had traded a bad line break for lost
   content.
3. **After `flex-wrap` + `min-w-0` on the inner row:** chips atomic, wrapping between each other,
   nothing clipped.

**Atomic units need somewhere to wrap TO.** Step 2 was a correct instinct applied without asking
what it would do to the container, and only the picture said so.

### Eleven raw tints, mode-split

Including `text-emerald-300/80` and its siblings on the confidence read — the chip that tells a rep
mid-call whether they are steady or rushing.

### The width came from the page, not from me

The first capture used 430px and the header wrapped. `[id]/page.tsx:436` puts this panel in
`max-w-md` — **448px**. Re-shot at the real width before judging the layout, because a layout
judged at a width the product never uses is how this harness nearly produced its first false
finding on day one.

The wrap was still there at 448. Confirmed, then fixed.

### And a capture of mine that was a fraud

The second state was supposed to be "the mic died mid-pitch". I set `audioCapturing: false` against
a **live** socket, and waited on `/audio|mic|recording/i`.

The banner is gated on `!live` (`:320`), so it could never have rendered. **The matcher passed
anyway — on the words "MIC LEVEL", which appear in every state.** A green capture of a screen that
did not contain the thing it was named for.

Eighth vacuous wait of this session, and it was written in the same file whose docstring warns
about them.

Replaced with the real condition — `status: "error"`, no audio capture — which renders
`notRecordingBanner`'s "Recording stopped — nothing is being captured.", and a matcher on that
sentence.

```
$ npx tsc --noEmit -p tsconfig.json → exit 0
$ npm run visual -- liveCoaching    → 2 passed, 4 images
```
