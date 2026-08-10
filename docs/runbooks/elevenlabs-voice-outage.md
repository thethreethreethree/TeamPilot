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
| `stt-scope` and/or `tts-scope` failing with **`missing_permission`** | Key lacks a permission scope (usual cause; happens when a key is **regenerated** or a **Restrict Key** toggle is on with the wrong endpoints granted) | Edit the key → under **Endpoints**, set **BOTH** of these to **Access**: **"Speech to Text"** *and* **"Text to Speech"**. If you **regenerated** the key, update `ELEVENLABS_API_KEY` in Vercel and **redeploy**; if you only toggled endpoints on the same key, it's live immediately. |

> **⚠️ The exact trap (2026-08-09):** the endpoint is **"Speech to Text"** — **NOT "Speech to Speech."** They're two adjacent rows. "Speech to Speech" is voice-*conversion* and this app does not use it; enabling it does nothing for the outage. Live coaching + transcription need **Speech to Text**; Jeff's voice + cues need **Text to Speech**. Enable exactly those two.
>
> **⚠️ Key ID vs. key secret:** the long hex string shown next to a key in elevenlabs.io → API Keys is the key's **ID**, not the usable secret (the real key, `sk_...`, is shown only once at creation). If a call returns `"api_key_id_used_as_api_key"`, someone pasted the ID. The app's `ELEVENLABS_API_KEY` must be the **secret**, not the ID. **The instant tell:** a real key **starts with `sk_`**; a 64-char hex with no prefix is the ID. `voice-health`'s `key-format` check now flags this up front — if it says *"value doesn't start with sk_"*, it's the ID.
>
> **⚠️ MULTIPLE Vercel projects (2026-08-09, cost the most hours of all):** this repo deploys to MORE
> THAN ONE Vercel project (e.g. `team-pilot` AND `team-pilot-6wlo`). Only one serves `elostate.com`.
> If you set `ELEVENLABS_API_KEY` in the *wrong* project, prod never sees it no matter how many times
> you delete/recreate/redeploy — the symptom is "I fixed the value and redeployed and it's STILL the
> ID." **Confirm which project is prod:** `curl https://elostate.com/api/health` → the `deploymentUrl`
> field names the project (`team-pilot-…`), OR check each Vercel project's **Domains** for `elostate.com`.
> Set the key in THAT project. (Diagnostic: `GET /api/coach/sales-session/voice-key-shape` returns
> `{startsWithSk}` for what the LIVE deployment actually loaded — hit it with `curl` after any change.)
>
> **⚠️ The Vercel value that "won't save" (2026-08-09, cost hours):** if you edit `ELEVENLABS_API_KEY` and `voice-health` *still* reports the old value after a redeploy, the save isn't reaching the running app. Causes: (a) it was saved to **Preview** but not **Production**; (b) a **Shared/Team** env var of the same name overrides the Project one — check the **Shared** tab and fix it there too; (c) the edit silently reverted. **Foolproof fix:** delete `ELEVENLABS_API_KEY` in *both* Project and Shared tabs, then re-create it fresh (`sk_...`, all environments incl. Production), save, and trigger a **fresh** deploy (a git push, or Redeploy with **Build Cache unchecked** — a cached redeploy can reuse the old env snapshot).
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
