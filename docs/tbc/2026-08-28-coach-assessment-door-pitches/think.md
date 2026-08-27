---
started_at: 2026-08-28T04:00:00+08:00
---

# THINK — Coach Assessment stale: feed door pitches into the coaching content

## Why (the record — diagnosed from live data, hypotheses refuted)
The founder reported the Coach Assessment stale ("no new content"). I diagnosed from live data (§1.2), and it REFUTED
my first guesses — good, that's why I instrument, not assume:
- Capture NOT broadly broken: 0 `coach.capture_failed` in 7d; the founder's own session had audio.
- Backoff NOT broken: `occurred_at` is set (0 NULL of 39); the "3h loop" is the cron correctly draining a backlog of
  thin sessions one-per-run.
- Aggregation NOT stale: it surfaces newest dissects first; the route reads fresh (dynamic via cookies).

The real cause: the Coach Assessment content is fed ONLY by coaching-session dissects, but the reps' MAIN work is
DOOR PITCHES — and door pitches (which produce `pitch_analyses` with `strengths`/`improvements`) never fed the
assessment. A rep who pitches all day but rarely does a coaching session reads as "no new content." I surfaced this
to the founder (§3.3), who chose to **feed door pitches into the assessment** and **merge the text into Doing Well /
Coaching Focus**.

## The fix (§1.5.1 layer 2 + §3.4)
- `coachAssessmentAggregate.ts` — new `aggregateCoachingContent(dissectRows, pitchRows)`: merges coaching-session
  dissects (`{point}`/`{opportunity}` objects) AND door-pitch analyses (plain-string `strengths`/`improvements`) into
  one newest-first view for Doing Well (strengths) / Coaching Focus (growth). Both normalized to strings.
- `coach-assessment/route.ts` — per rep, ALSO reads `pitch_analyses` (rep_id + company_id scoped; EXACT head count +
  recent-N content), merges via the new aggregator, and returns a `pitchCount`. §3.4 honest-degrade extended to the
  two new queries.
- `coach-assessment/page.tsx` — a rep has content if `dissectCount > 0 OR pitchCount > 0` (a pure-pitcher is no longer
  blank); the badge reads "N sessions dissected · M pitches analyzed".
- Reverted a wrong first attempt (feeding the after-pitch event) — after-pitch is for SALES SESSIONS (overlaps
  dissects), not door pitches; the memory's two-flow note caught it.

## Verified end-to-end (§1.5.1)
Live: Moses has 36 pitch_analyses with real coaching text (now merged with his 38 dissects); the founder has 3. The
content is genuine pitch analysis (§3.4 — not fabricated). Blank reps have 0 pitch_analyses (they knock but their
pitches don't yet analyze — the capture fixes shipped today address that upstream).

## Gate (A30)
`aggregateCoachingContent` tests: pitch strings map to Doing Well/Focus; dissects+pitches interleave newest-first; a
pure-pitcher gets content; malformed rows degrade without throwing.

## Session-read manifest (A22 — read_at ≥ started_at 04:00:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T04:22:00+08:00",
    "why_it_governs": "Understand the staleness from the record before changing anything.",
    "how_this_build_will_embody_it": "Diagnosed from live data; both initial hypotheses were refuted before I built." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T04:22:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session (04:22)." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-56", "read_at": "2026-08-28T04:22:10+08:00",
    "why_it_governs": "Retrospective from the actual event record — not theorizing a bug forward.",
    "how_this_build_will_embody_it": "Live queries refuted capture-broken / backoff-broken / stale-aggregation; found the true source." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-73", "read_at": "2026-08-28T04:22:15+08:00",
    "why_it_governs": "Organic + Holistic — reuse the existing aggregation; don't break the rep's own my-training view.",
    "how_this_build_will_embody_it": "aggregateDissectContent stays for my-training; the new merge is additive; page/route ripple traced." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "89-92", "read_at": "2026-08-28T04:22:20+08:00",
    "why_it_governs": "Layer 2 — the assessment must actually reflect the reps' real work, verified end-to-end.",
    "how_this_build_will_embody_it": "Confirmed live that Moses's 36 pitches now feed his card; a pure-pitcher is no longer blank." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "150-152", "read_at": "2026-08-28T04:22:22+08:00",
    "why_it_governs": "THINK-first, then search — form hypotheses about the staleness and confirm/deny against the data.",
    "how_this_build_will_embody_it": "Formed capture/backoff/aggregation hypotheses, tested each against live data, and followed the one the evidence supported." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-354", "read_at": "2026-08-28T04:22:25+08:00",
    "why_it_governs": "Guide-don't-overtake — the fix direction + wiring were the founder's decisions.",
    "how_this_build_will_embody_it": "Surfaced the diagnosis + the source + the merge design as pickers; built what the founder chose." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-28T04:22:30+08:00",
    "why_it_governs": "Honesty — the content is REAL pitch analysis, and a failed read degrades honestly.",
    "how_this_build_will_embody_it": "Merges genuine pitch strengths/improvements; the two new queries join the honest-degrade guard." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T04:22:35+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from data, surfaced decisions, gated the merge, verified live." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T04:22:40+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T04:22:45+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T04:22:50+08:00",
    "why_it_governs": "Gate the lesson — the merge logic must be locked so a payload-shape drift can't silently break it.",
    "how_this_build_will_embody_it": "aggregateCoachingContent has tests for both shapes, interleaving, pure-pitcher, and malformed-degrade." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T04:22:55+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + EXIT code." }
]
```
