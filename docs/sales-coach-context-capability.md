# Sales Coach: in-person vs video capability (honest state)

Assessment 2026-07-06, prompted by "is video fine-tuned like in-person?". Kept
so the decision below has a concrete reference and future audits don't re-derive
it.

## What adapts for BOTH contexts (works today)

- `context: 'in_person' | 'video'` is a first-class session field, chosen at start.
- **All post-call + live LLM prompts inject the context** ("in-person, door-to-door"
  vs "online video call"): live cues, review, moments, score, why. Coaching
  *language* fits the channel.
- Outcomes are comparable by context (in-person vs video close-rate).

## What is IN-PERSON-tuned (the recent work) — video is NOT

The live audio pipeline captures **mic-only** (`getUserMedia({audio:true})`),
uniformly, for both contexts. There is NO call/tab-audio capture anywhere in the
coach (`getDisplayMedia` is used only by the feedback-screenshot tool).

- **In-person:** the one mic holds BOTH voices in the room → agent-vs-prospect
  separation (pitch cluster + loudness + the "I'm speaking" toggle + earcon)
  works. This is what was fine-tuned.
- **Video:** the mic is **agent-only** — the prospect is on the far end of the
  call, their audio in the rep's headphones/speaker, NOT the mic. So:
  - ✅ Rep-delivery signals (filler spikes, pace) still work — that's the rep's mic.
  - ❌ Agent-vs-prospect separation and prospect-turn cues ("cues fire when the
    prospect's turn ends") do NOT — the prospect isn't captured.
  - The live-panel copy ("tell your voice from the prospect's", "you apart from
    the prospect") is in-person-accurate but **misleading for video**.

## Root cause

`useLiveCoaching(sessionId)` is **context-blind** — it never receives the
session context, so the live layer cannot branch capture or UI by in-person vs
video. Context reaches the post-call prompts but not the live pipeline.

## The decision (founder)

**Option A — full two-speaker live capture for video.** Add
`getDisplayMedia({audio:true})` (share-tab audio) mixed with the mic, giving the
pipeline rep-mic + prospect-call-audio as TWO real sources. Video is actually
*easier* than in-person here — two genuine streams, no pitch guessing. Cost: the
browser "choose what to share" prompt is a real UX step the rep must do each call.

**Option B — rep-delivery-live + separate-post-call.** Keep video live coaching
to the rep's own delivery; do full agent/prospect separation post-call from an
uploaded recording. Cost: no live prospect-reactive cues on video calls.

**Shared prerequisite (either way):** thread `context` into `useLiveCoaching` +
the live panel so the live layer is context-aware (today it isn't), and make the
video copy honest instead of promising separation video can't deliver.
