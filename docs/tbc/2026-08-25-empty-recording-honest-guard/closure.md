# CLOSURE — empty/unplayable recording → honest "No audio captured", not a relayed "corrupted"

## What shipped
A playable-container guard at the pitch worker's STT chokepoint: a recording that doesn't begin with a valid webm
EBML / mp4 ftyp header (the observed 5-byte Cues stub — an empty capture on the single-blob fallback path) now
terminates as an honest "No audio was captured (empty or unplayable)" instead of being sent to STT and surfaced as a
misleading "invalid_audio / corrupted." Built ONLY after the real bytes were inspected — the correction of this
turn's earlier assume-first mp4 misdiagnosis.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Targeted: 14 worker tests green incl. the new headerless-stub case and the
unchanged b5cdb61d recovery cases (disjoint inputs).

## The un-named reliance
- **Every legitimate recording begins with EBML (webm) or ftyp (mp4).** MediaRecorder emits the EBML header in the
  first webm chunk and ftyp in the first mp4 fragment; the stitch preserves the first segment's start. So a
  header-absent buffer is unplayable by construction — the guard can't reject a valid recording. Pinned by the
  "valid-header default mock still reaches STT" test (a header-present buffer is NOT short-circuited).

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "A recording that HAS a valid header but contains no media (header + trailer, no clusters) would pass the guard and could still fail/transcribe-empty.",
    "why_skipped": "Not observed in the real data — the 7 confirmed stubs are all HEADERLESS (5-byte Cues). A header-present-but-empty file would hit the existing empty-transcript guard (STT returns no words → honest 'No speech detected') OR STT-rejection, both already handled honestly. Adding a byte-size floor to catch it risks the founder's 'NO minimum length' line and is speculative without a real instance — so I did not build it.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-25T11:00:00+08:00",
    "outcome": "OPENED + reasoned from the honesty-chain: the two downstream honest terminals ('No speech detected' on empty transcript at worker.ts H1; STT-rejection catch) already cover a header-present-but-empty file without a misleading 'corrupted'. So the honesty property holds for that case too via existing guards; no additional code needed now. Would revisit only if a header-present-empty instance appears in the capture data."
  },
  {
    "id": "R2",
    "item": "This makes the failure HONEST but does not RECOVER the lost pitch, nor fix WHY the client captures empty recordings (the real reliability issue).",
    "why_skipped": "The client-capture root cause needs device/UA data the capture-diag hole is currently not recording (0 capture_failed events for the affected company — a 5-byte final data event sets sawData=true so the client never flags it). Investigating that is the founder-approved next step (Q1 answer this turn); it must be diagnosed from data, NOT assumed — the exact discipline this turn's mp4 error violated.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```
