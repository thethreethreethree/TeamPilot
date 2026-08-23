# Meeting Coach + Prep-up — device validation protocol

> The live-capture client (mic / WebSocket / AudioContext / MediaRecorder) is **not unit-testable** — it can only
> be confirmed on a real device. This is the exact checklist to prove the full feature works end-to-end. Run it
> once on a phone with an in-ear earpiece. Updated 2026-08-23 for Prep-up (Ph 1–5), the post-meeting Dissect, and
> the DoorLog iOS capture fix.

## Preconditions (should already be true — verify)

1. **Migrations applied** ✅ (2026-08-23): 0237 (`session_kind`) + 0238 (`meeting_preps` / `meeting_prep_documents`)
   are applied and the ledger is reconciled (`npm run db:reconcile` → 0 drift). No action needed.
2. **Nav flag on** ✅: `NEXT_PUBLIC_MEETING_COACH_ENABLED=true` is set + a build after it deployed. Verify: a
   sales_coach or hub account sees **"Meeting Coach"** in the sidebar (hard-refresh). If missing → the env var is
   on the wrong Vercel project or not scoped to Production.
3. **Build is current**: `curl https://elostate.com/api/health` → `build.commit` is `55fd7837` or later.

---

## Part A — Prep-up → agenda-aware meeting (≈8 min)

1. Open **Meeting Coach → "Prep this meeting first →"** (or `/dashboard/meeting-coach/prep`).
2. Fill a **goal** ("Lock the launch date + owner"), add 2–3 **must-discuss topics** ("launch date", "budget",
   "who owns release notes"), and **upload a document** — try an **image with a note** (tests OCR) and a PDF.
   - ✅ EXPECT: autosave (no explicit save needed); the image step lets you add a note; the doc list shows it.
   - ✅ OCR: an image of text (a whiteboard photo / a printed page) is read — extraction is best-effort (fails →
     the note still saves; it never blocks).
3. Tap through to **start the meeting from the prep** (the panel shows **"✓ prep loaded"**).
   - ✅ EXPECT: the session is created linked to the prep (status: Connecting → Listening).
4. **Talk 3–4 min** as a stand-up: cover the launch date, but deliberately **never mention "budget"**; circle a
   point without deciding; mention a task with no owner.
   - ✅ EXPECT: agenda-aware cues — hints toward the goal, a drift nudge, and (as you near the end) an
     **"uncovered topic"** alert that **budget** hasn't been discussed. Cues are spoken to the earpiece.
   - ✅ ALSO: **Coach me now** forces a cue even mid-silence.
5. Tap **Stop** → ✅ returns to setup (no dead-end); the "Meeting ended" screen shows an **honest recording state**
   (saving / saved / — never a false "review is ready" if nothing saved).
6. Open the **Review** (`/dashboard/meeting-coach/<id>/review`).
   - ✅ EXPECT: **Agenda coverage** — a goal-attainment pill (yes/partial/no) + a covered/missed topic checklist
     (budget shows **missed**), plus decisions / action-items-with-owners / open-items measured from the transcript.
   - ❌ IF it shows "The review didn't generate — try again" → a transient dissect failure (it self-heals on the
     next open; the H4 fix means it is NOT cached as permanently empty).

## Part B — plain meeting/huddle (no prep) — the MVP path (≈5 min)

Same as Part A steps 3–6 but start directly from **Meeting Coach → Huddle/Meeting → In person → Start** (no prep).
- ✅ EXPECT: cues still fire (generic facilitation, no agenda); the review shows decisions/actions (no agenda
  section, correctly).

## Verify it persisted (read-only, against the live DB)

For the session you ran:
1. **Cues recorded** — `coaching_cues` has rows (mode `suggestion`/`guide_response`, text, `latency_ms`, `trigger`
   e.g. `undecided`/`uncovered_topic`).
2. **Audio saved** — `audio_asset_url` is set, OR the `${company}/${session}/chunks/` prefix holds 15s chunks
   (the stitch cron builds `recording.webm` within a few hours if you never cleanly Stopped).
3. **Kind + prep link** — `session_kind` = `huddle`/`meeting`; if you used Prep-up, `meeting_preps.session_id`
   points at the session.

---

## Part C — DoorLog iOS pitch capture (the trust-crisis fix) — on an iPhone (≈3 min)

The field data showed iPhone pitches recording **zero audio** (AudioContext starving the recorder); the fix ships
in `55fd7837`. Confirm it on a real iPhone:

1. Macro Mode → **Record Pitch**, talk **60+ seconds**, **Stop**, pick an outcome, **Save**.
   - ✅ EXPECT: NO amber "no audio was recorded" banner; the pitch appears in the Report Card and, shortly, gets a
     transcript + analysis (not "Still processing…" forever).
   - ✅ IF the mic genuinely drops mid-pitch (a real call comes in), you now get a **live "mic stopped" warning**
     so you can re-record — that's the honest path, not silent loss.
2. **Confirm from the data** (the real proof):
   ```
   node scripts/diag-capture-failures.mjs
   ```
   - ✅ PASS: **no NEW** `doorlog.capture_failed` events after the `55fd7837` deploy timestamp (the AudioContext
     fix held).
   - ❌ IF new iOS events still appear: they now carry the exact cause (trackEnded / recorderError / etc.) — that's
     the next data-led step, not a guess. The same script also flags whether the **live/meeting** recorders show
     the iOS signature (they share the AudioContext-on-mic pattern; their fix is separate because their context
     feeds STT).

---

## What a PASS proves
- Prep-up captures context (incl. image OCR) and the coach is **agenda-aware** (hints, drift, uncovered-topic).
- The meeting transport (mic → Scribe STT → cue → earpiece TTS) works on real hardware; the brain gives
  grounded facilitation cues, not sales cues.
- The post-meeting **Dissect + agenda coverage** render and measure the meeting's consequences (what it produced,
  never whether the coach's cues were obeyed).
- The DoorLog **iOS capture fix** actually captures audio on iPhone (confirmed from the events, not assumed).

## Known-and-expected (NOT failures)
- **No "who's dominating" cue** — the live imbalance monitor needs per-speaker labels; single-mic MVP is unlabeled,
  so it stays silent by design (N-party live diarization is the deferred enhancement).
- **A video meeting** — `context: video` is accepted, but platform-caption attribution isn't built; treat video as
  "capture the room audio" for now.

## If something fails
- **Nav entry missing** → the `NEXT_PUBLIC_MEETING_COACH_ENABLED` env var isn't on the serving Vercel project /
  Production, or the deploy predates it (redeploy).
- **Cues never fire but transcript fills** → the cue route / `liveMeetingCue` / DeepSeek; check the console for
  `[coach/meeting-cue]` and the `/cue` POST status.
- **Transcript never fills** → STT: the WS close code is in the error banner (ElevenLabs realtime scope, same
  class as `reference_elevenlabs_scoped_key_401`).
- **Audio not saved** → the `/audio-chunk` POSTs (network tab) or the clean-Stop `persistRecording` sign→upload.
- **iOS pitch still no-audio** → run the diag (Part C) — the cause is now recorded, not guessed.
