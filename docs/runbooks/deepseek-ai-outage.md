# Runbook — DeepSeek AI outage (pitch analysis, scoring, "Your read", live coaching)

**Symptom (what a rep or manager sees):**
- Live coaching, "Coach me now": "Coach couldn't respond right now. Ask again in a moment."
- "Your read" on a call: "The AI coach is unavailable right now, so nothing was written. Your recording is saved.
  Try again in a few minutes."
- "Score them all": stops at the first recording with "The AI service is not answering right now, so nothing can
  be scored at the moment."
- Door pitches stay "processing" instead of getting their report card.

Every AI feature runs on one provider, DeepSeek, with one key (`DEEPSEEK_API_KEY`). So when DeepSeek is down,
all of them fail together. Production has no second provider: founder picker 2026-10-02, "DeepSeek only, fail fast".

There are two different causes with different fixes. Tell them apart first.

---

## Step 1 — Which one is it (1 minute)

1. **DeepSeek's status page:** https://status.deepseek.com. An incident on "API Service" or "Chat Service" means
   it is their outage. (2026-10-01 from about 19:27 UTC: "DeepSeek Web/API Degraded Performance", resolved by
   about 03:58 UTC the next day.)
2. **The balance:** platform.deepseek.com → Billing. Zero means out of credit (2026-09-22 17:00 to 09-25).
3. **Vercel → `team-pilot` → Logs**, search for:

| Log line | Means |
|---|---|
| `[llm] deepseek not answering (2 outage failures in a row); failing fast until …` | DeepSeek is timing out or answering 5xx. The app has stopped calling it for a minute at a time. |
| `[doorlog/worker] AI provider not answering — pitch … deferred 5 min; attempt NOT spent.` | A door pitch is waiting out the outage. Nothing lost. |
| `[doorlog/worker] AI provider out of credit — pitch … deferred 15 min; attempt NOT spent.` | The balance is empty. |
| `[runAndStoreDissect] AI provider unavailable — session … left for the next pass; no backoff marker.` | A call's review is waiting for DeepSeek. Nothing lost. |

If Sentry is set up (`/api/health` → `capabilities.errorReporting.server: true`), an outage also raises one Sentry
issue: "AI provider deepseek is not answering; failing fast".

## Step 2 — What to do

| Cause | What the app already does | What you do |
|---|---|---|
| **DeepSeek outage** | Each server stops calling DeepSeek after 2 failures in a row and fails at once for 60 s, then tries one call. Door pitches wait (retried every 5 min, attempts kept, for up to 24 h after recording). Call reviews are retried on the next pass. Scoring stops and says why. | Nothing; wait for DeepSeek's status page to clear. Afterwards press **Score them all** again. Pitches and reviews resume on their own. |
| **Out of credit** | Door pitches wait (retried every 15 min, attempts kept, no time limit). Scoring stops and says "out of credit". | Top up the DeepSeek balance. Then press **Score them all** again. |

## Step 3 — After a long outage

- A door pitch older than **24 hours** when DeepSeek comes back has spent its attempts as before and may be
  `failed`. To re-run failed pitches, adapt `docs/ops/2026-09-25-requeue-pitches-failed-on-402.sql` (written for
  the September out-of-credit outage). It changes production data, so it runs only with the founder's go-ahead.
- Check it is really back: `/api/health` answers, and in the Logs the `pitch-processing-cron` requests return 200
  in well under a minute. During the 2026-10-01 outage every run hit the 300 s limit and returned 504.

## What is NOT covered

- Speech-to-text and voices are ElevenLabs, a separate provider: see `docs/runbooks/elevenlabs-voice-outage.md`.
- The fail-fast memory is per server instance. A freshly started instance waits out up to two 45 s timeouts before
  it learns of an outage.

*Written 2026-10-02 from docs/tbc/2026-10-02-an-ai-outage-fails-fast, docs/tbc/2026-10-02-an-outage-is-not-an-attempt
and docs/tbc/2026-10-02-someone-is-told-when-it-breaks.*
