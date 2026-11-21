# Unreferenced recordings in storage (2026-11-21)

Read-only measurements of production (`SUPABASE_DB_URL`, `storage.objects` + every column that can reference a file).
Nothing was deleted or changed.

## What is there

`public.system_storage_usage()` (0271): **storage 1,195,863,977 bytes (1.196 GB)**, database 50.2 MB. All files are in
the `assets-v1` bucket: 1,569 files, 1,140.5 MB.

| Path shape | Files | MB | What it is |
|---|---|---|---|
| `<company>/<yyyy>/<mm>/<uuid>.<ext>` | 650 | 642.4 | uploads through `buildStoragePath` (session uploads, door-log blobs, C.A.R.E / files) |
| `<company>/<session>/…` with a live pointer | 595 | 253.4 | live-session chunks / stitched recordings |
| `<company>/doorlog/<id>/…` | 324 | 244.6 | door-log chunks and stitched recordings |

Every dated file was matched against all seven columns that can name a file: `coaching_sessions.audio_asset_url`,
`coaching_retranscribe_cache.audio_asset_url`, `files.storage_path`, `care_rcd_media.storage_path`,
`meeting_prep_documents.storage_path`, `pitch_scores.audio_url`, `pitches.audio_path`.

**463 audio files (401.5 MB) are referenced by none of them** (plus 3 video, 4.3 MB; 5 images, 1.7 MB). They were
created 2026-06-26 → 2026-10; no row in `events` mentions any of their file ids.

| Month | Audio uploads | Unreferenced | % |
|---|---|---|---|
| 2026-06 | 17 | 17 | 100 |
| 2026-07 | 21 | 20 | 95 |
| 2026-08 | 446 | 122 | 27 |
| 2026-09 | 380 | 301 | 79 |
| 2026-10 | 44 | 3 | 7 |
| 2026-11 | 3 | 0 | 0 |

## Why it matters

1. **Erasure cannot reach them.** §3.1.1 erasure finds a customer's recordings through the session's pointer. A
   recording with no pointer is invisible to it, so a customer who asks to be erased can still have their voice in
   storage. This is the sharper problem than the bytes.
2. **Quota.** 1.196 GB is over the Free plan's 1 GB — the limit that suspended the project on 2026-11-11
   (docs/SUPABASE-QUOTA-OUTAGE-2026-11-11.md). The project serves normally now, so the plan was most likely upgraded
   or the spend cap removed [INFERRED]; without these files storage would be ~0.79 GB.
3. Nothing in the app can show, play, purge or erase them.

## Where they came from (diagnosis)

- **The retention purge, 2026-07-16 → 2026-09-04.** It ran as "delete after 2 days" from `be7b076a` (07-16); the next
  day `3a08a5b9` is titled "the purge could report success while orphaning audio forever (false-ok write)". It became
  "keep each rep's last 20" on 08-26 (`2df24b2d`) and moved to the shared `removeRecordingAudio` on 09-04
  (`7ee0a911`). That helper removes the exact `assets-v1/…` path and refuses a shape it does not know, so the current
  purge and delete paths do not orphan files [OBSERVED: removeRecordingAudio.ts:61-66].
- **Sign-then-commit uploads (still possible).** `createSignedUploadTarget` gives the browser a path; the file is
  uploaded; a LATER request records the path (door-log, /api/files, C.A.R.E sign routes). If that later request never
  arrives — a closed tab, a failed submit — the file stays with nothing pointing at it. By construction, not a bug in
  one route. Consistent with the residual 7% in October.
- Correlation (not proof): of the 463, 93 sit within minutes of a door-log pitch save, 135 near a sales session, 235
  near nothing.

## Options (founder decision — deletion is irreversible)

1. Delete the unreferenced audio older than 7 days, once, with a dry-run list first and an audit row; then a nightly
   sweeper for signed uploads never committed after 24 h.
2. Delete only after an export (download them first), then as 1.
3. Keep them; record that erasure cannot reach them.

## Decision and outcome (2026-11-21)

Founder chose **delete + nightly sweeper** (picker, recommended option).

- **The rule, once:** migration 0299 `rss_unreferenced_uploads` (service role only). Tested on PGlite 16.4: of an
  orphan, a session-referenced file, a pitch-referenced file, an image, a chunk path, a 2-hour-old upload and a video,
  only the orphan audio and the video qualify at 24 h; signed-in users are refused. Applied to production;
  verify:live passed.
- **Safety before deleting:** every text/JSON column of all 158 public tables scanned for the candidates' ids — no
  mentions.
- **Dry run** (`scripts/sweep-unreferenced-uploads.mjs`, same code as the cron, 7 days): 466 files, 405.7 MB, 7
  companies — exactly the measured set (463 audio + 3 video).
- **Applied:** removed (confirmed by Storage) 466 files, 405.7 MB. One audit row per company (`recording.orphan_purge`,
  system actor, every path listed): 7 rows, 466 files.
- **Checked after, independently:** storage 1,195,863,977 → **770,413,195 bytes** (0.77 GB); candidates now 0; every
  dated pointer still resolves — sessions 21/21, pitches 103/103, files 55/55, 0 missing.
- **Nightly from now:** `/api/coach/sales-session/unreferenced-upload-sweep-cron` at 04:00 (24 h minimum age, 500 per
  run, audited). **INVARIANT 40** fails the build if a new route writes dated uploads without its referencing column
  being in 0299 — mutation-tested (a column removed from 0299 → caught; a new writer → caught).
