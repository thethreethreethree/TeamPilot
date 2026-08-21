# Capture-fix validation protocol (2026-08-21)

The capture fixes are live but **unvalidated on a real device** — the reconnect/recorder behavior can't be
tested headless. This is the exact sequence to prove each fix, and how to read the result. Do it on a **phone**
(the reps' real conditions), on a **15+ minute** call (long enough for the ~15-min token expiry that drops the
socket).

After each test, run the inspector to see that exact session end-to-end:

```
node scripts/diag-session-inspect.mjs "<your rep name>"   # or a session UUID
```

It prints a one-line VERDICT: `transcript=YES/NO  audio=YES/NO  dissect=YES/NO`.

---

## Test 1 — the NEVER-STOPPED case (the dominant real-world path)

This is how reps actually end calls: they **don't tap Stop**, they just leave.

1. Start a live coaching session on your phone.
2. Talk (both sides) for 15+ minutes. Lock/unlock the phone once mid-call (simulates a real field rep).
3. **Close the tab / navigate away — do NOT tap Stop.**
4. Wait for the auto-close cron (runs hourly; the session must be >6h old to auto-close, so check the next day)
   — OR trigger it sooner if you want.
5. Run the inspector.

**PASS:** `transcript=YES` (segments present, both agent + customer) AND `audio=YES` (chunk objects uploaded +
a stitched `recording.webm`). This proves the incremental-audio upload + the transcript flush both survive a
session the rep never Stopped — the case that was failing 79% of the time.

## Test 2 — a mid-call DROP recovers (P0 reconnect)

1. Start a session; talk for a minute.
2. Toggle airplane mode ON for ~5 seconds, then OFF (forces a WS drop + reconnect). Keep talking after.
3. Watch the on-screen status: it should go `connecting…` → `live` again, and the recording indicator should
   NOT flicker to "not recording."
4. Continue to 15+ min so the ~15-min token-expiry drop also happens and recovers.
5. Tap Stop this time (tests the clean-Stop path too), then run the inspector.

**PASS:** capture continued through the drop — `transcript=YES` with turns from BOTH before AND after the drop,
`audio=YES`. If instead the session went silently quiet and never recovered, that's a fail — report the close
code shown in the error banner.

## Test 3 — the loud failure is honest (not silent)

1. Start a session; talk.
2. Turn airplane mode ON and leave it on for ~2 minutes (exhausts the reconnect budget).

**PASS:** you see a clear banner — *"Live transcription dropped and couldn't reconnect. Your audio is still
recording — tap Stop to save it…"* — NOT a session that just goes quiet. (Then turning the network back on and
tapping Stop should still save the audio.)

---

## What each result means
- `transcript=YES` → the STT reconnect + 4s flush are working (Tests 1-2).
- `audio=YES` (chunks + recording.webm) → the incremental upload + stitch are working (Test 1 especially — it's
  the never-Stopped proof).
- `dissect=YES` → the review generated (on Stop, or via the 3-hourly backfill for a never-Stopped session).

If any test fails, the inspector output + the on-screen close code are exactly what I need to diagnose it.
