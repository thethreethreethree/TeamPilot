# BUILD — usage roster surfaces audio-capture honesty

### Consume the already-computed withAudio signal (§1.5.1 / §3.4)
- write-path: `StandardSessionsManagerView.tsx` — the roster annotation now renders
  `"{count} sessions · {withAudio} with audio · last active {day}"`, and the all-failed case (count>0, withAudio=0)
  renders `"⚠ none with audio"` (the ⚠ glyph is a colored warning independent of CSS, so it pops in a scanned roster).
- read-path: a rep who was active but captured no usable audio (the iOS webm-stub failure) no longer reads as healthy;
  the founder sees the failure at a glance in the surface built to monitor usage.

### Gate the lesson (A30)
- write-path: `__tests__/StandardSessionsManagerView.render.test.tsx` — mocks the `/team` + `/team-activity` fetches;
  asserts a withAudio=0 rep shows "⚠ none with audio" (never a bare healthy count) and a healthy rep shows "8 with audio".
- read-path: dropping `withAudio` from the render again fails the test (the exact "dead surface" regression that just
  occurred).

## Files
- `src/components/sales-coach/StandardSessionsManagerView.tsx` — roster annotation surfaces withAudio + flags all-failed.
- `src/components/sales-coach/__tests__/StandardSessionsManagerView.render.test.tsx` — render gate.

## Ripple (§6 item 5)
No route/schema/API change — `team-activity` already returned `withAudio`; this consumes it. The leader-visibility framing is preserved (unsorted
activity, not a rank). No effect on the rep self-view (managers only) or the per-session drill-in (which already showed
🎙/no-recording per session).

## Honest limit
jsdom render + a mocked aggregate proves the annotation surfaces the signal; the live end-to-end (a real rep's failed
captures showing "⚠ none with audio" in prod) is founder visual-verify — the same class as the view-session build's
real-data check (Knute 0→44).
