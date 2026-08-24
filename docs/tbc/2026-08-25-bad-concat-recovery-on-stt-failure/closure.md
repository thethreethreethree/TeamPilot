# CLOSURE — bad-concat recovery: salvage the first segment when STT rejects a two-init file

## What shipped
A last-resort recovery on the pitch worker's STT-rejection path: when ElevenLabs rejects a stitched recording as
"corrupted" and the bytes are a bad concat of two init segments, the worker truncates to the valid FIRST segment
and retries STT once. It runs ONLY after the full buffer was already rejected, so it can never harm a good
recording — worst case is one wasted STT call on audio that was already failing. It salvages iOS bad concats
stitched BEFORE the mp4-reseam fix (whose chunks are purged, so a re-stitch can't help) and is defense-in-depth
for any container the reseam doesn't yet recognise. This CORRECTS my earlier (wrong) claim that already-failed
pitches had no automated recovery path.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Targeted: 34 tests green across the stitch + worker files, incl. the 4
new (truncate helper: webm/mp4 concat → segment 1, clean file → null; worker: retry-and-recover, and no-retry when
there is no second init).

## The un-named reliance
- **The heuristic's false-positive risk is neutralised by placement, not by the heuristic being perfect.**
  `findSecondInitSegment` can, in principle, match a coincidental byte run in audio payload. The recovery leans on
  the fact that it only ever runs AFTER STT rejected the full buffer: a good recording passes STT and never
  reaches the branch, and a wrong-offset split on an already-rejected buffer just fails STT again (falls through
  to the original throw). So a false positive costs one STT call and never corrupts a good result. This placement
  invariant is the load-bearing reliance; it is pinned by the worker test's "no wasted retry when there's no
  second init" and the helper test's "null for a clean file."

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Terminal `failed` pitches (the founder's screenshotted one included) are NOT recovered — they do not reprocess, so the recovery branch never runs for them.",
    "why_skipped": "Recovering them requires RE-QUEUEING (resetting status so the worker reprocesses), which incurs STT+LLM reprocessing COST. Per prior record the mass-backfill cost gate is the founder's decision (project_coaching_capture_reliability: 'mass-backfill existing backlog (LLM cost → founder)'). So this is surfaced to the founder as an explicit, COUNT-informed re-queue decision — not performed here. Building the recovery FIRST is the precondition that makes a re-queue actually succeed.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-08-25T05:38:00+08:00",
    "outcome": "OPENED (lowest confidence → must be worked). Worked as follows: the recovery is the reusable machinery a re-queue depends on, so it is built and verified now; the re-queue itself is a founder cost decision. Next action recorded for the founder surface: a read-only count of corrupted-audio `failed` pitches (`error` matching invalid_audio/corrupted), then an AskUserQuestion picker to re-queue that specific set vs leave forward-only. Not auto-run because it spends money per pitch."
  },
  {
    "id": "R2",
    "item": "The recovery only splits at the FIRST second-init segment; a recording recreated 3+ times (two+ bad seams) yields only the first sub-segment, not all valid audio.",
    "why_skipped": "A single truncation recovers the first (usually longest, opening) segment — enough for a usable transcript. Multi-recreation recordings are rare (each needs another mid-call lock/reconnect), and the mp4-reseam now prevents new multi-seam concats at stitch time. Iterating the split would add complexity for a vanishing case.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-25T05:40:00+08:00",
    "outcome": "OPENED + CONFIRMED against the code. `truncateAtSecondInitSegment` returns `buf.subarray(0, at)` where `at = findSecondInitSegment(buf)` — the FIRST second-init offset (indexOf from 1 / from 8). So for a 3-segment concat [A][B][C] it returns just A; B and C are dropped. The claim is accurate. Kept high-confidence because: (1) A is the OPENING segment — the pitch's first ~seconds, the most analytically valuable part; (2) each extra seam needs a whole additional mid-call lock+reconnect, so 3+ is rare; (3) the mp4-reseam PREVENTS new multi-seam concats at stitch time, so this only concerns pre-fix cached files. A usable transcript from segment A is a strict win over the current terminal 'corrupted'. No code change; the one-segment behavior is the right cost/complexity trade."
  }
]
```
