# REMEDIATE - carry the recording's own timing into spoken_at

### F1 - the diarizer's per-segment offset was dropped at the upload boundary
gate-or-promise: gate
`buildSpeakerResponse` now accepts `start` and returns `startSeconds`; `label-transcript` accepts an optional
`startSeconds` per segment and writes `spokenAt: spokenAtFor(session.startedAt, seg.startSeconds)`; the
recovery replace path forwards it too, and migration 0249 lets the RPC store it.

The gate is `src/lib/coach/v5/__tests__/segmentTiming.test.ts` (5 tests) plus two added to
`label-transcript/__tests__/route.test.ts` which assert what `appendTranscriptSegment` actually RECEIVES -
not that a field was typed. Proven by mutation: making `spokenAtFor` fall back to the base for an unknown
offset failed exactly those two named tests and nothing else (pasted in check.md). A regression that drops the
offset, or that stamps an unknown one with the start of the call, fails a named test rather than going quiet.

### F2 - the app spec's premise about who captures the timing is wrong
gate-or-promise: declined
No gate, and the hole is named: this is a statement about a MARKDOWN SPEC in a different repository, and there
is nothing mechanical here that could fail on a document's premise being wrong. What is gated instead is the
consequence - the app repo pins its half (`attributionSegments`, proven by mutation there), so if a future
change drops the offset on the app side, that repo's suite fails. The spec text itself remains a promise: a
reader of doc 04 who does not also read this closure will still be told the app is the capture client.
