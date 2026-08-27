# CLOSURE — seq-0 header-chunk-loss fix

## What shipped
A MEDIUM finding from the capture-reliability audit: the Door Log client committed to the durable stitch path whenever
ANY chunk uploaded (`chunksUploaded > 0`), but the server stitch needs a contiguous run FROM seq 0 (the container
header). If seq 0 failed to upload while later chunks succeeded, the client discarded its good header-bearing local
blob and the stitch then failed → the pitch terminalized as "no audio recorded" despite recoverable audio existing.
Fix: track whether seq 0 specifically reached storage (`seq0Uploaded`) and gate the stitch path on it; otherwise fall
back to the single-blob upload of the local clean-Stop blob (which has the header). Happy path unchanged.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Recorder gate tests exercise both seq-0 branches; two DoorLog render tests
were made honest (a successful stream includes the header). Typecheck clean; 587 files / 3841 tests pass.

## The un-named reliance
- **jsdom is not iOS/Safari or live storage.** The recorder tests mock `fetch` per-seq to drive the seq-0-fail branch;
  they lock the client's ROUTING decision, not a real MediaRecorder or storage round-trip. The live end-to-end proof
  is the founder's iPhone field test (already-shipped iOS mp4 fix) + `diag-capture-live.mjs`.
- **The fallback assumes the local clean-Stop blob still holds a parseable header** — true for a normal Stop, which is
  exactly the case where later chunks uploaded but seq 0's network upload failed. A blob that itself never formed
  (mic-lost mid-recording) is the separate iOS-timeslice class, already handled by the requestData forcing.

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "LOW — non-atomic knock-before-pitch double-count on a persistent createPitch failure (route.ts ~119-142), plus a latent null-clientKnockId dedup hole. Refuted as MEDIUM (outcome integrity intact); left as a follow-up.",
    "why_skipped": "More involved + riskier than this narrow routing fix, and lower impact (a possible double COUNT, not lost audio). Not in the acute-pain path the founder flagged.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-27T08:45:00+08:00",
    "outcome": "OPENED — bounded follow-up; distinct from this audio-loss fix."
  }
]
```
