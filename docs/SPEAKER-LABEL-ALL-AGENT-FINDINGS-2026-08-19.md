# Findings — Session transcripts label every turn "AGENT" (2026-08-19)

**Reported by:** founder, via the Session Monitoring surface (`/dashboard/admin/monitoring`).
**Symptom:** In the founder-monitoring transcript panel, every segment of a session is labeled
**AGENT**, even though the transcript plainly contains the *client's* turns (e.g. a door-knock where
the prospect answers "Normal internet uses, streaming, Gmail, YouTube" is stamped AGENT).

Status: **diagnosed, fix gated on which root cause the record confirms.** A read-only diagnostic ships
to disambiguate before any pipeline change (diagnose-before-patch).

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
