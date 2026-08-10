# Runbook — ElevenLabs voice outage (live coaching / transcription / Jeff's voice)

**Symptom (what a rep or customer sees):**
- Sales Coach: "Live coaching's audio couldn't start" + "Live transcript didn't save" + "Couldn't
  process the recording right now — your audio is saved."
- C.A.R.E: Jeff's voice doesn't play / voice input doesn't transcribe (text chat still works).

If you see **any** of these, it is almost always **one** thing: the ElevenLabs API key. Live coaching,
recording transcription, coach voice cues, and Jeff's voice **all** auth against the same
`ELEVENLABS_API_KEY`, so one key problem breaks all of them at once. **This is a config issue, not a
code bug** — no deploy is needed to *fix* it (only to pick up a regenerated key).

This has recurred (2026-08-07, 2026-08-09). The trap: the symptom *looks* like "out of credits," but
the real cause both times was a **scoped key missing a permission**. Do not guess — run the probe.

---

## Step 1 — Diagnose (30 seconds, one click)

While logged in as a **manager**, open:

```
https://elostate.com/api/coach/sales-session/voice-health
```

It returns a plain verdict plus four checks — **api-key-present**, **quota**, **stt-scope**,
**tts-scope** — each `ok: true/false` with a `detail` string telling you the exact remedy. It runs the
real operations against ElevenLabs (read-only, ~1 character), so it reflects production reality, not a
guess.

(If the endpoint itself is unreachable, read the Vercel **Runtime Logs** and search for
`[care/voice] ElevenLabs rejected` or `[realtime-token] mint failed` — same information.)

First, rule out a provider outage at **https://status.elevenlabs.io** (both prior incidents were
account-side, not outages).

## Step 2 — Fix, by what the probe reports

| Probe says | Cause | Fix |
|---|---|---|
| `stt-scope` and/or `tts-scope` failing with **`missing_permission`** | Key lacks a permission scope (usual cause; happens when a key is **regenerated**) | In elevenlabs.io → **API Keys**, enable **BOTH** "Speech to Text" **and** "Text to Speech" (+ the realtime/Scribe permission) on the key. If you **regenerated** the key, update `ELEVENLABS_API_KEY` in Vercel and **redeploy**. |
| a plain **401** (no `missing_permission`) | Wrong/expired key, or a stray character | Re-check the Vercel `ELEVENLABS_API_KEY` value against elevenlabs.io. Redeploy. |
| `quota` **EXHAUSTED** (402/403) | Out of credits / plan limit | Top up credits or upgrade the plan at elevenlabs.io → Billing. **No redeploy needed.** |
| `api-key-present` false | Key not set in this environment | Set `ELEVENLABS_API_KEY` in Vercel → **redeploy** (the key is read at runtime but the deploy must have the env var). |

> **The #1 gotcha:** enable **both** scopes in one pass. If you fix only Speech-to-Text, live coaching
> and transcription come back but Jeff's voice + coach cues stay broken (Text-to-Speech). The probe's
> `tts-scope` check exists specifically so an STT-only fix can't read as "healthy."

## Step 3 — Recover the affected sessions (no data loss)

Recordings are **persisted before** transcription runs (`upload-recording` stamps `audio_asset_url`
first), so nothing is lost during the outage:

- A rep who **uploaded** a recording: once the key is fixed, they hit **retry** and the saved audio
  re-transcribes from storage (`/api/coach/sales-session/[id]/retranscribe`) — **no re-upload.**
- A **live-coaching** session that never recorded has no saved audio — that rep uploads their call
  recording (which now processes) to still get the transcript.

## Step 4 — Confirm

Re-open the `voice-health` endpoint — it should read **healthy** (all four checks `ok`). Have a rep
start a live coaching session, or play a Jeff reply in C.A.R.E, to confirm end-to-end.

---

**Blast radius reference** — one key powers all of these; fixing the key restores every one:
`realtime-token` (live coaching audio), `upload-recording` + `retranscribe` (transcription),
`coach/sales-session/tts` (coach cues), `care/tts` (Jeff's voice out), `care/stt` (Jeff's voice in).

**Code pointers:** `src/lib/care/voice/elevenlabs.ts` (`probeElevenLabsVoice`,
`describeElevenLabsAuthError`, `mintRealtimeSttToken`, `transcribeWithDiarization`,
`synthesizeSpeechStream`); probe endpoint `src/app/api/coach/sales-session/voice-health/route.ts`.

**Prevention (not yet built — needs an alert channel decision):** a periodic cron that runs
`probeElevenLabsVoice` and pages the founder on failure would surface a recurrence before a rep hits it
mid-pitch. Blocked on choosing a delivery channel (push delivery currently needs its VAPID setup).
