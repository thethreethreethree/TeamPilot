# REMEDIATE — Mobile recording / voice-memo upload

### Append-only double-write — upload on top of an existing transcript
gate-or-promise: gate

Fixed at TWO layers (defense in depth; the UI is the UX, the server is the gate):

- **UI (primary UX)** — `src/app/dashboard/sales-coach/[id]/page.tsx`: the file-pick upload now renders only
  when `transcript.length === 0`, so a rep can't trigger a second upload once a transcript exists (from live
  coaching OR a prior upload). The After-Pitch upload was already gated on the empty state (`!summary`).
- **Server (structural, §A30)** — `src/app/api/coach/sales-session/[id]/label-transcript/route.ts`: after the
  owner check, the route reads `getSessionTranscript(id)` and returns **409 `alreadyHasTranscript`** if the
  session already has a transcript. The UI is not the gate; a direct API call or a future UI regression can't
  double-append. Live coaching writes its transcript via `/finalize` + `/segments` (NOT this route), so the
  guard can never block a live save; the recovery re-transcribe only fires when the transcript is empty.

**The gate that fails without the fix:** `label-transcript/__tests__/route.test.ts` →
*"409 when the session already has a transcript (append-only double-write guard, A30)"* — asserts 409 +
`alreadyHasTranscript` + `appendTranscriptSegment` NOT called. Remove the guard and this test fails.
```
$ npx vitest run "src/app/api/coach/sales-session/[id]/label-transcript" "src/app/api/coach/sales-session/[id]/upload-recording"
 Test Files  3 passed (3)
      Tests  29 passed (29)
VITEST_EXIT=0
```

**Residual (named, not fixed — §A33):** the check-then-append is a TOCTOU — two truly-concurrent
`label-transcript` requests for the same empty session could both pass the existence check and both append.
NOT row-locked here: it is one rep writing one session, the client holds a synchronous `labelingRef` latch
against double-submit, and a row-lock on an append-only transcript write would be over-engineering for a
single-writer path. The realistic double-append (upload on top of an EXISTING transcript) is fully closed;
only a sub-second self-race remains, and it is bounded by the single-rep reality.
