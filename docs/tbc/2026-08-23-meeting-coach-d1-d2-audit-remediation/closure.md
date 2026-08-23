# CLOSURE — Meeting Coach D1 (huddle agenda-aware) + D2 (doc-upload hardening)

## What shipped
The two founder-chosen deferred items from the Meeting Coach audit:

- **D1 — the huddle brain is now agenda-aware.** A prepped huddle forwards its agenda into the huddle brain, which
  now renders the must-cover points, reports `covered` point ids each pass, and can fire an `uncovered_topic` cue
  as the huddle ends — closing the inconsistency where the Dissect judged huddle agenda coverage the live coach was
  blind to. Tuned to the huddle's near-silent character: the agenda adds exactly ONE reason to speak (a must-cover
  point about to be missed at the end); a prep-less huddle renders no agenda block at all (no regression).
- **D2 — the document upload is hardened at the shared chokepoint.** The prep-doc route now routes both shapes
  through `validateUploadCandidate` (so a spoofed SVG/executable is blocked by the same blocklist as the rest of
  the app, not the route's weaker `classifyKind` copy), re-checks the REAL uploaded size via `getAssetObjectInfo`
  at confirm before buffering, and the OCR path refuses an image-bomb via a `sharp` header read before Tesseract
  decodes it. +12 tests across the two items; no schema change; additive + backward-compatible.

## The un-named reliance
- **D1** relies on `parseCueDecision` already parsing `covered` generically and gating an AUTO cue on a valid
  trigger — so `uncovered_topic` delivers only because it was added to `HUDDLE_TRIGGERS`. It also relies on the cue
  route already loading the agenda + persisting `coveredTopicIds` for BOTH kinds (it does — one code path, no
  kind branch); the huddle change is brain-only.
- **D2** relies on `validateUploadCandidate` being pure (no IO) so the route can call it at both sign and confirm,
  and on `getAssetObjectInfo` reading the size from storage metadata WITHOUT downloading — the real-size cap holds
  even if the client under-declared at sign. The image-bomb guard relies on `sharp` reading dimensions from the
  header without a pixel decode. The app-layer size cap now makes the live bucket `file_size_limit` (AMD-011
  external config) belt-and-suspenders rather than the sole defense — an over-cap file fails LOUD (413) regardless.
- **A26 boundary honesty:** the chokepoint-bypass class was swept to its reachable boundary; `door-log` sign is
  excluded because its filename is the server constant `"pitch.webm"` (no untrusted input), NOT overlooked.

## Residual (A36)

```json
[
  {
    "id": "coverage-whole-jsonb-lost-update-race",
    "item": "setMeetingPrepTopicsCovered + updateMeetingPrep overwrite the whole topics array with no concurrency control; concurrent cue writes (or a cue vs a mid-meeting agenda PATCH) can lose coverage. D1 does NOT change this — huddle coverage merges the same way meeting coverage does (read-modify-write of the JSONB array).",
    "why_skipped": "The live hook fires one cue at a time (no concurrent timer confirmed), so the race stays latent for huddles too. A DB-additive coverage set or optimistic-concurrency guard is the fix if concurrency is introduced.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T09:20:00+08:00",
    "outcome": "Flagged; revisit if cues ever fire concurrently (unchanged by D1)."
  },
  {
    "id": "prep-huddle-ui-affordance",
    "item": "Prep-up is presented as a meeting feature in the UI; a huddle becomes agenda-aware only if a prep row is linked to the huddle session (e.g. prep then toggle kind→huddle). There is no explicit 'prep a huddle' entry point.",
    "why_skipped": "D1 was scoped to the BRAIN (make it consume the agenda it's given), per the founder's 'make the huddle agenda-aware'. Whether to surface a first-class 'prep a huddle' flow is a product/UX call, not a correctness gap — the brain now behaves correctly whenever an agenda is present.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T09:20:00+08:00",
    "outcome": "Flagged for a product decision; the backend is ready either way."
  },
  {
    "id": "bucket-file-size-limit-live-verify",
    "item": "The live assets-v1 bucket file_size_limit (AMD-011 external config the repo can't hold) is now belt-and-suspenders behind the app-layer 25 MB cap, but has not been re-verified against the live Supabase project this session.",
    "why_skipped": "The app-layer cap (validateUploadCandidate + getAssetObjectInfo real-size) now fails an over-cap upload LOUD (413) regardless of the bucket setting, so correctness no longer depends on it. Verifying the bucket limit is a cheap belt-check, not a blocker.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-23T09:20:00+08:00",
    "outcome": "Flagged; confirm the bucket limit at go-live per docs/MEETING-COACH-GO-LIVE.md."
  },
  {
    "id": "multi-company-latent-lows",
    "item": "cue/dissect load prep by session_id via the admin client without a session.companyId===companyId assertion; meeting_prep_documents.company_id isn't constrained to the parent prep's. Unchanged by D1/D2.",
    "why_skipped": "All safe under single-company use (memory: multi-company DEFERRED). Cheap hardening when multi-company lands.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T09:20:00+08:00",
    "outcome": "Flagged for the multi-company milestone."
  }
]
```
