# Findings — Session transcripts label every turn "AGENT" (2026-08-19)

**Reported by:** founder, via the Session Monitoring surface (`/dashboard/admin/monitoring`).
**Symptom:** In the founder-monitoring transcript panel, every segment of a session is labeled
**AGENT**, even though the transcript plainly contains the *client's* turns (e.g. a door-knock where
the prospect answers "Normal internet uses, streaming, Gmail, YouTube" is stamped AGENT).

Status: **diagnostic RUN 2026-08-19 — initial framing corrected (see results below).** The systemic
"every session is all-agent" reading is NOT borne out; the real issue is narrower and intermittent.

---

## Diagnostic results (run 2026-08-19, read-only)

**The specific screenshot was a misread.** It showed session `273bb962` (Humza, active). That session's
stored data is `a:7 c:4` with segment order `[a,a,a,c,a,c,c,a]` — **properly split.** The panel showed
only the TOP of the transcript (the agent's opening monologue, correctly `agent`); the customer turns sit
below the fold, unscrolled. Humza has **0** all-agent sessions.

**But a real, narrower issue exists platform-wide.** Of ~140 sessions with a transcript, **38 are
genuinely all-agent** (customer=0, agent>0); 102 are properly split; a further **154 have no transcript at
all** (a separate capture-reliability concern). Breakdown of the 38:

- retranscribe-cache single-cluster: **0** → **cause #1 (batch diarization) is ruled out.**
- pure-live (no saved audio): **30 / 38** → the driver is **live-side**.
- **Every affected rep also has properly-split sessions** (Moses 14 all-agent / 47 split; Knute 7/12;
  Anthony 5/8; the founder himself 3/10). Same rep, same setup, intermittent → **cause #2 (live-attribution
  collapse on a quiet far-mic prospect) or #3 (manual "I'm speaking" lock left ON), not a per-rep
  misconfiguration.**

**Also visible (secondary):** short far-mic customer interjections get *absorbed into an agent-labeled
segment* rather than split out (the screenshot's turn 2 glued "Normal internet uses…" — a client answer —
into an agent turn). This is an attribution-granularity weakness, present even on otherwise-split sessions.

**Capture-reliability finding (may outrank the label issue).** Of 300 recent sessions, **154 have no
transcript at all.** Breakdown:

- **127 are `active`** — never-stopped / abandoned. The live path only persists the transcript on **Stop**,
  so a session the rep never ends captures nothing. 127 never-ended sessions is high — either reps routinely
  don't hit Stop, or sessions aren't being marked `ended`. Any real call in this bucket lost its coaching data.
- **27 are `ended`** (a finished call that captured nothing): **1** recoverable (has audio → retranscribe),
  and **26 are total capture loss** (no transcript AND no audio) — the rep completed a call and got *nothing*.

No-data is a worse honesty failure than mis-labeled-data (the rep believes a call was coached when it wasn't),
so the 26 total-losses + the 127 never-ended sessions likely deserve priority over the label attribution.

**What the data CANNOT resolve:** #2 vs #3 — because neither the manual-override state nor the attribution
source (content / loudness / pitch / locked) is persisted per segment. The stored result is just the final
`speaker`, so a locked-toggle session and a collapsed-attribution session are indistinguishable after the
fact. **This is the real gap to close first.**

**Recommended next step (revised):** persist the **attribution source** per segment (a small additive
field written by the live path) so the next occurrence is diagnosable as fact, not guesswork — then the
#2-vs-#3 fix is targeted. Alternatively, a fast human signal: ask the reps whether they use the "I'm
speaking" earbud-tap toggle. Do NOT rewrite far-mic attribution (#2) speculatively — the data does not yet
justify it.

---

## Confirmed (from the code, this session)

1. **The render is innocent.** [`monitoring/page.tsx`](../src/app/dashboard/admin/monitoring/page.tsx#L174)
   prints `seg.speaker` verbatim and only *colors* it (`=== "agent" ? brand : secondary`). It does not
   hardcode "AGENT".
2. **The data layer is faithful.** [`vendorMonitoring.ts`](../src/lib/monitoring/vendorMonitoring.ts#L157)
   reads the `speaker` column as-is and defaults a null to `"unknown"` — **never** to `"agent"`.
3. **Therefore the stored `coaching_transcript_segments.speaker` is genuinely `"agent"` on every row**
   for these sessions. This is a **write-side** problem, not a display bug.

## The collapse mechanism

The labeled write path
[`label-transcript/route.ts`](../src/app/api/coach/sales-session/[id]/label-transcript/route.ts#L132):

```
speaker = (seg.speakerId === agentSpeakerId) ? "agent" : "customer"
```

This is correct **only when diarization returned two clusters.** When batch diarization returns a
**single** speaker cluster — the documented failure of "a single far mic"
([`useLiveCoaching.ts`](../src/lib/coach/v5/useLiveCoaching.ts#L288)) — *every* segment's `speakerId`
equals `agentSpeakerId`, so all of it becomes `"agent"`. The client's audible words are captured but
stamped as the rep.

## Three candidate root causes — each a different fix

| # | Cause | Fingerprint in the data | Where the fix lives |
|---|-------|-------------------------|---------------------|
| 1 | **Single-cluster batch diarization** (ElevenLabs couldn't split one far mic) | all-agent **with** saved audio, retranscribe-cache shows **1 cluster** | `retranscribe` / `label-transcript` — detect single cluster, surface "couldn't separate two voices" instead of silently labeling all-agent (honesty: no confident wrong label) |
| 2 | **Live-attribution collapse** (far-mic prospect too quiet → content classifier defaults to agent) | all-agent, **pure-live** (no saved audio) | live attribution / `composeProvisional` path |
| 3 | **Manual "I'm speaking" lock left ON** ([`useLiveCoaching.ts`](../src/lib/coach/v5/useLiveCoaching.ts#L264)) | all-agent, pure-live, but the **same rep has other properly-split sessions** | UX/behavior — auto-reset or a visible "locked to you" indicator; NOT a pipeline bug |

Note: `isVideo` (context === "video") also forces all-agent by design (mic-only), but that is **not**
this case — an agent-only mic would never have captured the client's words that appear in the transcript.

## The diagnostic

[`scripts/diag-speaker-labels.mjs`](../scripts/diag-speaker-labels.mjs) — **read-only**, no writes. For
recent sessions it reports the speaker distribution, audio-vs-pure-live, and the retranscribe-cache
cluster count, then tallies which cause fits. Run locally against prod (needs `SUPABASE_SERVICE_ROLE_KEY`):

```
node scripts/diag-speaker-labels.mjs "Humza"   # drop the name to scan all recent sessions
```

## Recommended next step

Run the diagnostic, read the TALLY, fix the confirmed cause. If most all-agent sessions are
**with-audio + single-cluster**, cause #1 is the fix and it is safe and well-scoped. Do **not** rewrite
the live attribution engine (#2) unless the data shows pure-live collapse — that path is sensitive and
its all-agent rate should be measured, not assumed.
