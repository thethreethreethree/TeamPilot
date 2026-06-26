# Closure: File system — complete ground-up audit (§1.7) + Findings A & B fixed

**Date:** 2026-06-26
**Builder:** Agent
**Trigger:** Founder: "file system has many bugs for all system, please do a COMPLETE audit using our previous defined auditing process." Two bugs pictured (delete broken; no classify option at upload → auto-casual).

## Method
Three parallel readers mapped the four layers (UI/actions, upload/classification, storage/API/RLS/events). The agents DISAGREED on the delete bug and one made the §A9 error of calling the classification dead-end "not a bug" (works-as-designed at the data layer ≠ works at the §1.5.1 workflow layer). I root-caused both pictured bugs against the real code rather than trust the agent conclusions.

## Findings (ground-up, ranked)

| # | Layer | Finding | Severity | Status |
|---|-------|---------|----------|--------|
| A | Data/API | **Delete silent no-op.** `deprecateFile()` returned `!error` — true even when RLS filtered the UPDATE to zero rows; the page handler ignored the response too. A failed delete reported success. | HIGH | ✅ fixed (commit f74bfe7) |
| B | Workflow §1.5.1 | **No classify-at-upload → casual-cap dead-end.** `FileDropzone` uploaded bytes immediately; the classify modal only opened AFTER. At 3/3 the POST rejected (429) before any file existed → no path to classify-instead. Chat/C.A.R.E uploads are always-casual with no path at all. | HIGH | ✅ fixed (this commit, Files page) |
| C | Storage | Deprecated files orphan their bytes forever (`deleteAssetBytes` exists, never called); no GC/retention runbook. | MEDIUM | flagged |
| D | UI | Other file actions swallow errors (`openFile`/download silently returns) — same silent-failure class as the delete bug. | MEDIUM | ✅ fixed |
| E | UI/Data | Cards show uploader "Unknown" — `cardData` never resolves `uploaderId`→name. (Cap counts by uploader_id and the founder hit 3/3, so attribution records correctly — this is display-only.) | MEDIUM | ✅ fixed |
| F | Events §3.5 | `asset.file.downloaded`/`shared`/`access_changed` declared in vocabulary, never emitted → parts of §4 readout hollow. | LOW | flagged |
| G | Data | `classifyFile` deletes-then-reinserts join rows non-atomically (no txn) — a mid-way failure can half-classify. | LOW–MED | flagged |

## Finding A fix (shipped f74bfe7)
DELETE route now mirrors the migration-0063 access-route pattern: admin client + explicit `uploader OR (admin AND same-company)` check + `.select()` row-affected verification. Guarantees the deprecate lands when authorized and returns a real 403/500 otherwise — regardless of RLS subtlety. Page handler checks `res.ok` and toasts. Converts a silent no-op into a correct, observable operation.

## Finding B fix (this commit)
Pre-upload classify modal (founder chose this over cap-hit-recovery). Files-page upload now:
1. `FileDropzone` gains an opt-in `onFileSelected` prop — when provided, picking a file defers to the parent instead of uploading immediately. Chat/C.A.R.E (no prop) unchanged.
2. The Files page holds the file in `pendingFile` and opens `ClassificationModal` in a new **draft mode** (`onSubmitDraft` prop): the modal collects dept/task/description/tags/access BEFORE upload, then the parent POSTs the file WITH those fields.
3. Classification present → server skips the casual lane entirely → never counts against or is blocked by the 3/day cap. The dead-end is gone: a capped user classifies and uploads.

Draft mode reuses the existing classify form (DRY); the fileId-dependent access-grant logic is guarded (specific_people grants deferred to post-upload edit, with a UI note).

## Pre-ship audit (4 personas)
- User: classify-before-upload removes the dead end; cancel uploads nothing; clean continuity.
- Engineer: one form (ClassificationModal) for both edit + draft; opt-in dropzone prop.
- Adversary: server remains the validation gate; specific_people defaults restrictive.
- CFO: no new cost.
- A21: edit-pencil, task-assets, chat/C.A.R.E paths all unchanged. A14: pendingFile render branch cleans up on cancel/success.

## Remaining work (recommended order, §A20)
1. ~~**E** — resolve uploader name~~ ✅ done (client-side from team list; departed members still "Unknown" — server-side join is the §A10-complete follow-up).
2. ~~**D** — surface errors on download/other actions~~ ✅ done (openFile toasts on failure).
3. **C** — storage GC/retention runbook (operator decision).
4. **B follow-up** — extend classify-at-upload to chat + C.A.R.E (currently always-casual).
5. **G, F** — atomicity + measurement integrity.
6. **E follow-up** — server-side uploader-name join so departed members aren't "Unknown" (full §A10).

## NOT verified (needs founder runtime check)
- The actual delete now working in the founder's account (the fix is certain in code; the founder's specific files were uploaded by "Unknown" — if delete STILL fails after this, the new explicit error will name the real cause).
- Pixel/UX of the pre-upload modal.
