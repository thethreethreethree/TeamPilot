# Sales Coach — live-test checklist (2026-07-06 build)

> The behaviors below are **verified in code (unit tests + build)** but **UNTESTED
> live** — they can only be confirmed on a real call with a real mic. This is the
> founder's checklist for the next live session. For each: what to do, what
> "correct" looks like, and what to capture and send me if it's wrong.
>
> Console has a `[live-coaching]` log line per committed turn — open DevTools
> (video) and read/screenshot it; it's the fastest bug report.

---

## 1. In-person — Agent vs Prospect labels (the original bug)

**Do:** Start an **in-person** session. Have a two-person exchange where the
prospect clearly asks for something ("how much is it?", "can you show me the
pricing?") and you clearly offer ("I can show you…", "let me walk you through…").

**Correct:** each turn is labeled within ~1 turn of being spoken — prospect
questions → CUSTOMER, your offers → AGENT. The `[live-coaching]` log shows
`content=…` matching who actually spoke, and `src=content` on the obvious turns.

**If wrong:** screenshot the log line(s) for the mislabeled turn — I need
`vol=`, `pitch=`, `content=`, the final `→ label [src=…]`, and the actual text.

---

## 2. In-person — pitch-anchor nudge

**Do:** In-person, with a prospect whose voice is **similar in pitch** to yours,
talk for ~3–4 turns **without** tapping "I'm speaking."

**Correct:** when the voice split is genuinely struggling, the **"I'm speaking"
toggle glows** and a line appears: *"Hard to tell you and the prospect apart by
voice…"*. The moment you tap "I'm speaking" (or the voices separate), it clears.
It should **not** nag when separation is working, and never appears on video.

**If wrong (nags constantly / never shows):** tell me — the thresholds (pitch
confidence < 0.5, ≥2 of last 3 turns) are §4 tuning knobs I can adjust after a
real run. Note roughly how many turns before it showed / that it never did.

---

## 3. Video — mic-only behavior

**Do:** Start a **video** session (headphones on, prospect on the far end).

**Correct:**
- The start panel shows the disclosure: *"On video, your mic hears **your** side…"*
- Every transcript turn is labeled **AGENT** (the coach can't hear the prospect
  through your mic — this is intended, not a bug). No phantom "CUSTOMER" turns.
- Delivery cues still fire (filler/pace steadying, "coach me now", stall nudges);
  prospect-side cues (objection / buying-signal) do **not** — expected mic-only.
- The confidence read never shows a stuck "find your rhythm / 100% talk share"
  (that ripple was fixed — talk-share is hidden on video).

**If wrong:** if you *need* the coach to react to the prospect's live words on
video, that's the deferred `getDisplayMedia` far-end-capture option — one flag to
lift. Tell me and I'll scope it.

---

## 4. filler_spike trigger (STT question — can only be answered live)

**Do:** On any live session, speak a turn with obvious fillers ("um… uh… like…
you know…") and watch the transcript text that gets committed.

**Correct / the actual question:** does the committed transcript **preserve** the
"um/uh/like"s, or does ElevenLabs Scribe strip them? The `filler_spike` steadying
cue only works if they survive.

**Report:** just tell me whether the fillers appear in the transcript text. If
they're stripped, `filler_spike` silently never fires and I'll wire an alternative
(the other stress trigger, pace_spike, is unaffected either way).

---

## Fast path

Open DevTools console on a video test, run through 1–4, and send me the
`[live-coaching]` log + a note on anything that didn't match "correct" above.
That's enough for me to fix the named cause (no guessing — instrument-first, per
the diagnostic-logging discipline).
