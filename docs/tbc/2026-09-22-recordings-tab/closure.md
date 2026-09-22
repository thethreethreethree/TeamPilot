# CLOSURE — the Recordings tab

## What is true now

Project 4 is built and its five siblings are no longer waiting on it. All seven items of guide
Step 4 work end-to-end, including the half of item 6 that lives on the rep's screen rather than the
manager's.

The thing that changed about the product, rather than about the code: **every number on every board
is now checkable.** Before this, a rep whose pitch scored 61.5 with three pattern moments could
read the verdict and had no way to hear the moment it came from. §3.3 says making the human a
participant is what makes an accurate-but-unwelcome finding survivable; that clause had no surface
until now.

## What I am relying on that nobody named

This is the half of closure that is easy to skip.

1. **`decodeAudioData` will work on the production audio.** It is verified against the unit
   boundary (`bucketPeaks`) and not against a real signed Supabase URL in a browser, because I
   cannot run one here. If the storage response is not CORS-readable, every recording renders the
   plain seek track with the markers on it and a one-line reason. That is a **degradation by
   design**, not a failure — but it is a degradation the founder will see before I do, and it is the
   most likely thing about this build to look wrong on first use. §1.5.3: an external precondition
   I have documented rather than verified.

2. **`coaching_transcript_segments.spoken_at` is populated for scored pitches.** The transcript
   panel is exact when it is and approximate when it is not, and it says which. I have not checked
   the live fill rate. If it is mostly null, item 5 works but degrades to the labelled-approximate
   path everywhere, which is honest and less useful than the board implies.

3. **`pitch_scores.session_id` links to the session whose segments those are.** The column exists
   and is nullable; I read its definition, not its data.

4. **A manager's browser can hold the decode.** A long recording is fetched whole to compute peaks.
   There is no size guard. On a 40-minute file this will be slow before it is wrong.

5. **The share request reaches a rep who can answer it.** The notification is written; there is no
   rep-side UI to press Grant or Decline yet — see below. Until there is, a rep can only answer by
   an API call, which means in practice the permission is currently a *block*, not a dialogue. That
   is the safe direction to fail, and it is not finished.

## Not built, and saying so on the screen where it matters

- **The rep's Grant / Decline control for a team-example request.** The event log, the policies and
  the notification exist; the button does not. This is the A31 seam of *this* build, named rather
  than hidden. It is small and it is next.
- **Pattern Interrupt's clips**, which depend on this player. Now unblocked.
- **The Rep progress tab** of Pattern Interrupt.
- **Rude-or-dismissive flags** in Needs-your-attention; that screen still says they are not wired.

## The incident this build produced

I overwrote a live route with `cat >` on a path I had not read — the Sessions tab's call-audio
endpoint, which had its own tested manager gate and a correction note in its header. It was caught
by that route's own test suite, six steps later, not by me.

Restored from `HEAD`, new route moved to `/pitch-recordings`, exported types renamed to
`PitchRecordingRow` / `PitchRecordingDetail`, rate-limit ids split.

The generalisable part is not "be careful". It is that **`cat > path` is an unconditional
destructive write and the entire gate is blind to it**: typecheck, lint, theme, RLS, invariant,
reachability and migration audits all pass happily on a file that replaced another file. The only
thing that caught it was a pre-existing test, and a route without one would have shipped deleted.
`git status` showed ` M` instead of `??` immediately after the write, and I did not look.

Worth a standing habit and possibly a gate: **check `git status` for an unexpected ` M` after
creating what is supposed to be a new file.** Proposing it rather than adding it — a new gate is the
founder's call and a bad one is worse than none (A30).

## Migrations live

0259, 0260, 0261 applied through the ledger. DB at 0261. 30 invariants hold. Re-run finds nothing
pending.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this build. The board PDF specifying this screen was opened and described on 2026-09-22 at line 31
of `docs/SYSTEM UPDATES AND REVISION 09-22-2026/EVIDENCE.md`; no other asset was consulted or
touched.
