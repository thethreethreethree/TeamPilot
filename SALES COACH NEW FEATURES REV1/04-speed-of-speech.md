# 04 — Speed-of-speech (pace) — REQUIRES native timing capture

**What it is.** The Coach Assessment's "speed" skill scores how fast the rep talks (words per minute) against a
comfortable band. The engine already existed but showed "not enough sessions yet" forever, because **the per-turn
timing it needs was never captured**. The web fix: the live client now stamps each transcript turn's
**`spokenAt`** (when the utterance was spoken) and sends it; the pace is then read as TRUE speaking tempo.

**App work is NATIVE and load-bearing:** the app is the capture client. If the app posts transcript segments
without `spokenAt`, the speed skill stays blank for every app-recorded session — exactly the bug the web just
fixed. So the app MUST stamp and send it.

## Web source of truth
- Capture: `src/lib/coach/v5/useLiveCoaching.ts` — each turn is stamped `spokenAt = <utterance start>` (epoch ms
  → ISO) and included in BOTH the incremental `/segments` flush and the Stop `/finalize` payload.
- Storage: `coaching_transcript_segments.spoken_at` (already exists — no migration). The POST bodies accept
  `spokenAt` (ISO 8601, e.g. `2026-09-10T12:00:00.000Z`); the server stores it via `appendTranscriptSegment`.
- Read/score: `src/lib/coach/v5/skillAnalytics.ts` — `agentWpm(segments)` computes TRUE speaking tempo: per
  agent turn, duration = gap to the NEXT timed segment; per-turn WPM via `turnWpm`; keep only plausible-speech
  rates (60–320 wpm, discards pause-dominated turns + timestamp glitches); take the **median**; need ≥3 clean
  timed turns else null. `speedScore(wpm)`: full 10 inside the band **110–150 wpm**, −1 per 10 wpm outside.

## The contract the app MUST honor
When posting transcript segments (both incremental flush and final), include per segment:
```
{ speaker: "agent"|"customer"|"unknown", text, seq, spokenAt: <ISO string> }   // spokenAt = the utterance START time
```
- `spokenAt` is the wall-clock time the utterance STARTED, not when it was flushed. Stamp it when the turn is
  captured, from the device clock, as `new Date(startMs).toISOString()`.
- Omit `spokenAt` only when the start truly isn't known; a present-but-wrong (flush-time) stamp corrupts the pace.

## Why it's the median of clean turns (don't shortcut to total-words ÷ elapsed)
The web tried words ÷ (first-to-last span) first; it measured throughput, not tempo, and mislabeled a rep who
speaks normally but pauses to listen as "too slow." The per-turn-median approach is the fix — mirror it. Do NOT
reintroduce the span-based version.

## App work summary
1. During live capture, record each turn's start time.
2. Send `spokenAt` with every segment (flush + finalize).
3. Nothing else — the scoring + the "speed" skill render server-side and appear in Coach Assessment (doc 1's
   endpoint family). New app-recorded sessions light up the pace skill automatically.
