# BUILD — capture the per-turn timing the speed metric needs, and read it as true tempo

### The live client stamps and sends each turn's spoken time
- write-path: `src/lib/coach/v5/useLiveCoaching.ts` — the `Turn` type gains `spokenAt`; at turn commit it is
  stamped from `utteranceStartRef.current` (the utterance start, epoch ms) → ISO. Both persist payloads (the
  incremental `/segments` flush and the Stop→`/finalize` batch) now include `spokenAt` when present.
- read-path: `appendTranscriptSegment` writes it to `coaching_transcript_segments.spoken_at` (server schemas
  already accepted it), so `agentWpm` finally has timing to read.

### The flush selector carries the field through
- write-path: `src/lib/coach/v5/segmentFlush.ts` — `FlushTurn` + `FlushSegment` gain `spokenAt`, and
  `selectUnflushedSegments` copies it out (omitted when absent — never a null/garbage value).
- read-path: a session dropped mid-call (tab close / crash) still persists the timing for the turns it flushed.

### agentWpm now reads true speaking tempo, not throughput
- write-path: `src/lib/coach/v5/skillAnalytics.ts` — `agentWpm` rewritten: per-turn WPM from the gap to the
  next timed segment (reusing `turnWpm` from liveStress), keep only plausible-for-speech rates (60–320,
  discarding pause-dominated turns + timestamp glitches), take the MEDIAN; too few clean turns → null. The
  span-based throughput computation (words ÷ whole first-to-last span) is gone.
- read-path: `aggregateSkills` → the Coach Assessment "speed" skill shows a meaningful pace for new sessions;
  a good listener who speaks at a normal tempo is no longer mislabeled "too slow." The 110–150 band is unchanged.

### The gate (A30)
- write-path: `src/lib/coach/v5/__tests__/skillAnalytics.test.ts` — agentWpm tests rewritten for the median
  approach, including the REGRESSION guard (a long listen pause must not drag tempo toward "slow") and the
  too-few-turns → null case. `segmentFlush.test.ts` pins spokenAt pass-through.
- read-path: `src/app/api/coach/sales-session/[id]/segments/__tests__/route.test.ts` pins that a POSTed
  spokenAt is forwarded to `appendTranscriptSegment` — the persist seam the whole fix depends on.

## Files
- `src/lib/coach/v5/useLiveCoaching.ts`
- `src/lib/coach/v5/segmentFlush.ts`
- `src/lib/coach/v5/skillAnalytics.ts`
- `src/lib/coach/v5/__tests__/skillAnalytics.test.ts`
- `src/lib/coach/v5/__tests__/segmentFlush.test.ts`
- `src/app/api/coach/sales-session/[id]/segments/__tests__/route.test.ts`

## Ripple (§1.5)
- `spokenAt` was already read behind `if (s.spokenAt)` guards by salesMoments/salesPivot/afterPitch (timeline
  origin) — capturing it lights up the call timeline as a bonus and changes nothing that wasn't null-guarded.
- `review/route.ts` + `cue/route.ts` build ephemeral in-memory segments for LLM calls (speaker+text only) — not
  persisted, so their `spokenAt:null` is untouched.
- No migration — the `spoken_at` column already exists.
- Old sessions have no stored timing, so pace lights up for NEW sessions only (honest limit, closure R1).
