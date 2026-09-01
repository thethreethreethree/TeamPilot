# BUILD — outcome-capture adoption prompt

### The move-on intercept
- write-path: `after-pitch/page.tsx` — `startNextDoor` now intercepts when `session.outcome == null` (opens a
  skippable prompt instead of leaving); `proceedToNextDoor` holds the unchanged create+navigate. A prompt card
  renders `OUTCOME_ORDER` through the SAME `recordOutcome` chokepoint (no new endpoint); an outcome tap records
  then proceeds, "Skip for now" proceeds without one.
- read-path: a rep who taps Start Next Door with no outcome sees "Before the next door — how did this one go?",
  logs it in one tap (or skips), and moves on — so Layer-1 KPIs get the outcome data they were starved of.

## Files
- `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx` — split start handler + skippable outcome prompt

## Ripple (§6 item 5)
- No new write path: reuses `recordOutcome` → `POST /[id]/outcome` → `setSessionOutcome` (already route-tested).
- No behaviour change when an outcome IS already logged (interceptor is a no-op → proceeds straight through).
- Applies to any owner on After-Pitch (Standard default + Expert); the inline capture control (Standard-only) and
  the session-page capture (Expert) are untouched — this only adds the move-on safety net.
