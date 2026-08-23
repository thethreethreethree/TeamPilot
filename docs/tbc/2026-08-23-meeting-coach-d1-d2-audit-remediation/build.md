# BUILD — Meeting Coach D1 (huddle agenda-aware) + D2 (doc-upload hardening)

### the huddle brain consumes the agenda (D1)
- write-path: `HuddleStrategy.analyze` now forwards `context.agenda` to `buildHuddleCueUserMessage`; the huddle
  prompt gains an agenda block (must-cover points + coverage marks + light doc context), the `uncovered_topic`
  trigger (in `HUDDLE_TRIGGERS`, so `parseHuddleCue` will deliver it), and `covered` in the output JSON.
- read-path: a prepped huddle now tracks coverage live (the route's existing `coveredTopicIds` persist path
  finally receives huddle coverage) and can flag a must-cover point missed as the huddle ends — so the Dissect's
  agenda judgment measures what the live coach actually worked toward, instead of grading against a blind brain.

### the huddle stays TIGHT (D1 no-regression)
- write-path: `renderAgenda(undefined)` returns `""` and the wrap-note's `uncovered_topic` clause is gated on
  `args.agenda`; the agenda instructions in the system prompt are scoped "ONLY when a PREP-UP AGENDA is provided";
  the doc-context cap is 1200 (tighter than the meeting's 2000).
- read-path: a prep-less huddle's user message contains NO agenda block (test-asserted) — today's near-silent
  behaviour is untouched; the agenda adds exactly one new reason to speak, and only near the end.

### the doc upload routes through the shared chokepoint (D2 — A27)
- write-path: `document/route.ts` calls `validateUploadCandidate` (via a `uploadSecurityRejection` helper) at BOTH
  sign (client-declared size) and confirm (real size from `getAssetObjectInfo`), returning 400 for a blocked type
  / 413 for over-cap / 400 for empty; a `not_allowed_type` falls through to `classifyKind` (which intentionally
  accepts odt/epub the global allowlist omits) — but ONLY after the blocklist ran, so a spoofed SVG/executable is
  caught even though `classifyKind` alone would pass an `image/svg+xml`.
- read-path: an SVG/exe/archive can no longer mint an upload target or be confirmed; a client that under-declared
  its size at sign is caught by the real-size re-check at confirm before the bytes are buffered.

### the confirm re-checks the REAL object before buffering (D2 — F1/F2 + external-config)
- write-path: confirm calls `getAssetObjectInfo(storagePath)` FIRST — null → 400 "Uploaded file not found" (no
  phantom path); then re-validates against the object's real size/content-type before `downloadAssetBytes`.
- read-path: a multi-GB object can't OOM the function (rejected 413 before the unbounded buffer); the app-layer
  cap fails an over-cap upload LOUD regardless of the live bucket `file_size_limit` (AMD-011 belt-and-suspenders).

### the OCR path refuses an image-bomb before decoding (D2 — MED-2)
- write-path: `extractImageText` reads dimensions via `sharp(...).metadata()` (header only, no pixel decode) and
  returns `""` when `width*height > MAX_IMAGE_PIXELS` (40 MP) or the header is unreadable — BEFORE Tesseract.
- read-path: a few-hundred-KB PNG that decodes to a multi-GB RGBA bitmap can no longer OOM the function ahead of
  the `MAX_OCR_MS` timeout (a synchronous decode the timeout can't interrupt); the note is still stored (graceful).

## Files
- `src/lib/coach/strategy/huddle/huddleCuePrompt.ts` — agenda block + `uncovered_topic` + `covered` output + agenda
  user-message rendering (D1).
- `src/lib/coach/strategy/huddle/huddleStrategy.ts` — forward `context.agenda` (D1).
- `src/app/api/coach/meeting-prep/[id]/document/route.ts` — chokepoint at sign + real-size re-check at confirm (D2).
- `src/lib/documents/extractImageText.ts` — sharp image-bomb dimension guard (D2).
- `src/components/sales-coach/meeting/MeetingPrepUp.tsx` — send `sizeBytes` at sign (D2 fast early reject).
- tests: `huddle/__tests__/huddleAgenda.test.ts` (+5), `document/__tests__/route.test.ts` (+3, now 9),
  `documents/__tests__/extractImageText.test.ts` (+4, new).

## Ripple (holistic)
- No schema change. D1 is additive: `parseCueDecision` already parsed `covered` generically + validates the
  trigger against `HUDDLE_TRIGGERS`, so adding `uncovered_topic` to that set is all the parse layer needed; the
  cue route already loads the agenda + persists `coveredTopicIds` for both kinds — no route change.
- D2 reuses the existing `validateUploadCandidate`/`getAssetObjectInfo` primitives (no new abstraction). A26 class
  swept: the doc route was the only in-class instance; `door-log` sign is excluded (server-constant `pitch.webm`,
  no untrusted input); `care/.../upload/sign`, `files/upload-url`, `upload-recording/sign` already validate at the
  chokepoint or its media-appropriate subset.
- The other `downloadAssetBytes` callers (dissect / auto-recover / retranscribe / upload-recording) resolve
  SERVER paths and feed STT (not an image decoder), so the getAssetObjectInfo + image-bomb additions are correctly
  scoped to the client-file doc route.
