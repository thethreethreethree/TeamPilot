---
started_at: 2026-09-09T14:21:30+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — speed-of-speech feedback never appeared because the timing it needs was never captured

## Why (the record — 9/2 partner meeting, verbatim)
> "Speed of speech feedback not yet appearing. John Reynolds explained it's difficult to measure due to lack
> of standard tempo; no resolution reached on how to define acceptable speed."

## Understanding (earned — and it corrected a wrong first read)
My FIRST diagnosis was that no pace metric existed and the open question was how to define "acceptable." That
was wrong, caught by searching before building (§1.5.2). The truth:

1. **The pace metric is already built.** `skillAnalytics.ts` has `speedScore` + a comfort band
   (`SPEED_BAND_LOW=110`, `HIGH=150`) + `agentWpm`, feeding the Coach Assessment "speed" skill. The live coach
   also measures pace (`liveStress.ts`) for real-time nudges. Reynolds' "lack of standard tempo" was already
   answered in-code (a comfort band).

2. **It never appears because the timing it needs is never captured.** `agentWpm` needs `spokenAt` on segments.
   The live client (`useLiveCoaching.ts`) never sent it — the finalize/flush payloads were `{speaker,text,seq}`
   — and the two server persist sites that could set it hardcoded `spokenAt: null`. So `agentWpm` returned null
   for EVERY session and the "speed" skill read "Not enough sessions yet" permanently. Same shape as the
   dissect-gate bug: a complete mechanism silently starved of a data/gate condition. (Timeline/moments/pivot
   timing degrade the same way — they all guard `if (s.spokenAt)`.)

3. **Activating it exposed a second, latent defect.** `agentWpm` divided total agent words by the whole span
   from first-to-last agent utterance — words per ELAPSED minute (throughput), not speaking tempo. Against a
   "130 wpm = unhurried delivery" band, a rep who speaks normally but pauses to listen would be mislabeled "too
   slow." Never observed because the metric was always null; landing the capture would activate the mislabel —
   a §3.4/§5 confident-well-formed-failure.

## The fix (founder chose, 2026-09-09)
1. **Capture the timing.** The live client stamps each turn's `spokenAt` from the utterance start
   (`utteranceStartRef`, epoch ms) and sends it; the finalize + segments schemas already accept it and
   `appendTranscriptSegment` already stores it — the only missing link was the client. Threaded through
   `segmentFlush.selectUnflushedSegments` too. Only NEW sessions gain timing (old ones have none stored — an
   honest limit the founder accepted, R1).
2. **Fix agentWpm to true speaking tempo.** Per-turn WPM from the gap to the next timed segment, keep only
   plausible-for-speech rates (60–320, discarding pause-dominated turns + glitches), take the MEDIAN. Measures
   how fast the rep talks WHEN talking, independent of how much they listen. Ships bundled so the activated
   skill is meaningful on day one (founder chose this over shipping the throughput metric).

## Ripple (§1.5 — what else this touches)
- `spokenAt` was already read by `salesMoments`/`salesPivot`/`afterPitch` (timeline origin) behind
  `if (s.spokenAt)` guards — capturing it LIGHTS UP the call timeline as a bonus, changes nothing that wasn't
  already guarded for the null case.
- `review/route.ts` + `cue/route.ts` construct EPHEMERAL in-memory segments (`id:"inline-"/"live-"`) for LLM
  calls that read speaker+text only — their `spokenAt:null` is never persisted, so unchanged.
- `agentWpm` has one consumer (`aggregateSkills`), which averages the sessions that HAD a number — a null
  session (too few clean turns) simply doesn't contribute. `speedScore` + the 110–150 band are unchanged (they
  were written for speaking tempo).
- No migration: the `spoken_at` column already exists (`appendTranscriptSegment` writes it).

## SS1.5.1 layers
- Layer 1: the timestamp is captured at its source (the turn), one field threaded through the existing flush.
- Layer 2 (the point): the "speed" skill now produces a MEANINGFUL number for new sessions, not a permanent
  "not enough yet" and not a miscalibrated throughput figure. Verified by tests (agentWpm tempo + the
  throughput-regression guard) and typecheck.
- Layer 4: no new surface — the existing skill card renders the now-present value.

## Session-Reads (A22)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "Understanding precedes solving; the first diagnosis was re-checked against the code, not assumed.",
    "how_this_build_will_embody_it": "The initial 'no metric exists' read was corrected by searching skillAnalytics before building — the picker was re-issued honestly." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-44", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "The methodology must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md + ThinkerThinker.md are in this tree; hashes pinned in front-matter." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "52-58", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "Identify the problem by looking backward at the actual record.",
    "how_this_build_will_embody_it": "The live capture + persist code and the never-activated metric were read to find why feedback never appeared." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "288-296", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "Trace what else a shared-state change affects before committing.",
    "how_this_build_will_embody_it": "The ripple section traces the timeline/moments/pivot benefit and the ephemeral-segment non-impact." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "Layer-2 effectivity: does the feature actually deliver the intended result end-to-end.",
    "how_this_build_will_embody_it": "Bundling the agentWpm fix ensures the activated skill is meaningful, not a miscalibrated number — the intended result, not just 'a value appears'." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "THINK first, then search to confirm; surface adjacent defects with evidence.",
    "how_this_build_will_embody_it": "Searching before building overturned the first diagnosis AND surfaced the agentWpm throughput miscalibration — both raised to the founder." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-325", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "Single source for a computation, consumed once.",
    "how_this_build_will_embody_it": "Per-turn WPM reuses turnWpm (liveStress) rather than a second WPM formula in skillAnalytics." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-380", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "No fabrication; degrade to an honest empty over a misleading number.",
    "how_this_build_will_embody_it": "Sparse/absent timing → agentWpm null → 'not enough yet'; pause-polluted turns are discarded so a good listener isn't mislabeled slow." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-432", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "Distrust the confident answer that arrived too quickly.",
    "how_this_build_will_embody_it": "The confident first read ('no metric exists') was wrong; re-checking the code caught it before building the wrong thing." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-448", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "A founder decision goes through a picker with a recommendation.",
    "how_this_build_will_embody_it": "The corrected diagnosis, the fix scope, and the agentWpm calibration each went to the founder as a picker." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "Governing methodology lives in the working tree.",
    "how_this_build_will_embody_it": "Both docs are in this tree and the cited ranges are the ones opened this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-604", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "Citations without session-reading are undetected violations.",
    "how_this_build_will_embody_it": "Each clause was opened for this build; read_at is in-session." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-697", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "A reported bug is one instance of a class; sweep the class.",
    "how_this_build_will_embody_it": "The class 'metric starved of uncaptured data' spans the pace skill AND the timeline/moments/pivot timing — all fed by the same spokenAt now captured." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "A prose lesson returns; encode it in a gate.",
    "how_this_build_will_embody_it": "The throughput-vs-tempo fix is pinned by a regression test that fails if agentWpm reverts to span-based." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1008", "read_at": "2026-09-09T14:21:40+08:00",
    "why_it_governs": "'Verified' names the command actually run.",
    "how_this_build_will_embody_it": "check.md pastes the whole npm run check output + exit code and the mutation result." }
]
```
