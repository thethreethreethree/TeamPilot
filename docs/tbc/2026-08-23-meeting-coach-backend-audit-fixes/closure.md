# CLOSURE — Meeting Coach backend/wiring audit fixes

## What shipped
The backend/wiring half of the founder-directed Meeting Coach audit: **INT-1** (the HIGH audio-loss — the dissect
now stitches the live chunks on demand when `audio_asset_url` is null, so a clean-Stop-failed-persist meeting is
reviewable instead of 409-looping forever), **INT-3** (the prep→session link reports its real result — no more
silent "prep loaded" over an unlinked prep), the **error-as-no-data** honesty gaps (`getMeetingPrep`/
`listPrepDocuments` throw → the route 500s honestly instead of a false 404/empty; the brain-side reads log-and-
degrade), and **INT-2** (short topic ids so coverage round-trips reliably + the dissect ORs-in live coverage
instead of discarding it). +5 tests; all 16 meeting suites (101 tests) pass; no schema change; backward-compatible.

Together with the UI commit (`9ee0f089`), the Meeting Coach audit's HIGH + the impactful MED findings are fixed.
The security agent found NO HIGH; the remaining items are defense-in-depth or multi-company-latent (below).

## The un-named reliance
- **INT-1** relies on `stitchSessionAudio` being idempotent + the chunk layout being shared (it is — one source
  in stitchSessionAudio.ts). The self-heal runs on the reviewer's first view (user-pull), not a cron — acceptable.
- **INT-2** short ids improve the LLM echo probabilistically; the OR-in is the hard guarantee that live coverage
  is never discarded. Old preps with UUID ids still work (the OR-in covers them).

## Residual (A36)

```json
[
  {
    "id": "huddle-ignores-agenda-int4",
    "item": "The cue route loads+passes the agenda for huddles, but HuddleStrategy ignores it (no agenda block / uncovered_topic), while the dissect judges agenda coverage for huddles — an inconsistency where the review measures what the live coach never worked toward.",
    "why_skipped": "Needs the huddle brain to consume the agenda (a feature addition) or a product call on whether huddles support Prep-up. Reachable only by prepping then toggling kind→huddle; Prep-up is a meeting feature.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T08:40:00+08:00",
    "outcome": "Flagged; decide huddle+prep semantics, then either wire the agenda into the huddle brain or block prep+huddle in the UI."
  },
  {
    "id": "doc-upload-chokepoint-bypass-sec-med1-2",
    "item": "The prep document route re-implements a weaker allowlist instead of validateUploadCandidate (MIME-prefix defeatable by a spoofed type; no app-layer size cap; unbounded download buffer), and the image OCR path has no decompressed-size (image-bomb) guard.",
    "why_skipped": "Defense-in-depth (LOW blast radius today: docs are owner-scoped + never served — a stored SVG/exe is retrievable only by the uploader). Route through validateUploadCandidate + getAssetObjectInfo + a bounded image decoder in a focused hardening pass; verify the live bucket file_size_limit (AMD-011).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T08:40:00+08:00",
    "outcome": "Flagged; would become a real XSS/malware vector if a 'share prep with the team' feature ships."
  },
  {
    "id": "coverage-whole-jsonb-lost-update-race",
    "item": "setMeetingPrepTopicsCovered + updateMeetingPrep overwrite the whole topics array with no concurrency control; concurrent cue writes (or a cue vs a mid-meeting agenda PATCH) can lose coverage or clobber edits.",
    "why_skipped": "The live meeting hook fires one cue at a time (hardcoded suggestion, no concurrent timer confirmed), so the race is latent. A DB-additive coverage set or optimistic-concurrency guard is the fix if concurrency is introduced.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T08:40:00+08:00",
    "outcome": "Flagged; revisit if cues ever fire concurrently."
  },
  {
    "id": "multi-company-latent-lows",
    "item": "cue/dissect load prep by session_id via the admin client without a session.companyId===companyId assertion; meeting_prep_documents.company_id isn't constrained to the parent prep's; persistOnly finalize doesn't check the stamp row-count.",
    "why_skipped": "All safe under single-company use (memory: multi-company DEFERRED). Cheap hardening when multi-company lands: add the assertions + the doc company_id=parent policy term.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-23T08:40:00+08:00",
    "outcome": "Flagged for the multi-company milestone."
  }
]
```
