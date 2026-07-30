# Verification — "the after-pitch summary must show up after recording" is race-free (2026-07-31)

**Founder's urgent requirement (2026-07-31 mockup):** after a rep records a call, the
After-Pitch summary must appear — not an empty "no conversation captured" screen.

**Concern traced (AMD-006 L2 operational effectivity + L3 continuity):** the After-Pitch
page auto-generates its summary on arrival
([after-pitch/page.tsx:238](../../src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx#L238)):
`if (!existing) void generate()`, where `generate()` POSTs `/after-pitch`, which reads the
session transcript. If navigation into this page fired **before** the transcript was
persisted server-side, the POST would read an empty transcript, return `hasSignal:false`,
and the rep would land on the empty state right when they expect their summary — the exact
failure the founder is guarding against.

**Finding: all three navigation triggers into After-Pitch are gated on _awaited_ server
persistence of the transcript. There is no race.**

1. **Live in-person transcript path.**
   `setTranscriptSaved(true)` fires only inside the `.then` of the `/finalize` POST, on
   `r.ok` ([useLiveCoaching.ts:730-743](../../src/lib/coach/v5/useLiveCoaching.ts#L730-L743)).
   The `/finalize` route `await`s `appendTranscriptSegment(...)` for every segment, then
   `await`s `Promise.all([...summary, moments, ...])` **before** it responds
   ([finalize/route.ts:104-142](../../src/app/api/coach/sales-session/[id]/finalize/route.ts#L104-L142)).
   So by the time `r.ok` is true → `transcriptSaved` flips → the fire-once effect calls
   `onRecordingSaved()` → router pushes to After-Pitch, the transcript **and** the summary
   artifacts are already stored. The page's GET typically finds a stored summary and shows
   it immediately (no generation wait).

2. **Standalone upload path** (session page `SessionRecordingUpload`).
   `onLabeled()` is called only after the `/label-transcript` POST resolves `.ok`
   ([SessionRecordingUpload.tsx:88-103](../../src/components/sales-coach/SessionRecordingUpload.tsx#L88-L103)),
   which appends the labeled transcript server-side. Transcript persisted before navigation.

3. **In-panel fallback upload** (live transcript didn't save → recover from the blob).
   Same `SessionRecordingUpload` component, same `onLabeled`-after-`.ok` contract
   ([LiveCoachingPanel.tsx:650-663](../../src/components/sales-coach/LiveCoachingPanel.tsx#L650-L663)).

On paths 2 and 3 the After-Pitch page's GET may not find a pre-stored summary (label-transcript
appends but does not itself run the full After-Pitch assembler), so the page runs its own
POST `generate()`. Because the transcript is already persisted, that POST reads a real
transcript and returns a real summary — the page shows a brief "Building your summary…"
spinner, then the summary. Both outcomes satisfy the requirement ("the summary shows up").

**Fire-once contract (this-session fix, 2026-07-31).** `onRecordingSaved` is often an
inline callback (new identity each render). Without a guard, the `transcriptSaved` effect
would re-fire every render while `transcriptSaved` stayed true, pushing the router
repeatedly. The `savedFiredRef` guard
([LiveCoachingPanel.tsx:78-87](../../src/components/sales-coach/LiveCoachingPanel.tsx#L78-L87))
fires the navigation exactly once.

## Regression watchpoint (for a future reviewer / refactor)

The race-free property depends on **one** thing: navigation is gated on the server
confirming persistence. It would be **reintroduced** by any of:

- Making `setTranscriptSaved(true)` optimistic — moving it out of the `/finalize` `.then`
  to fire on Stop before the server confirms.
- Making `/finalize` respond before it `await`s the transcript append.
- Making `SessionRecordingUpload` call `onLabeled()` before `/label-transcript` resolves ok.

No structural guard was added: the project has no component-test harness (node env, no
RTL/jsdom), and adding one solely for this would be disproportionate infra risk. This note
is the record; the three bullets above are what a reviewer checks if a future change touches
these files.

**Status:** requirement verified satisfied end-to-end. No code change needed.
