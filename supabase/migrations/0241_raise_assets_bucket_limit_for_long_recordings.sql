-- 0241 — Raise the assets-v1 bucket file-size limit so LONG session recordings can be stored.
--
-- ROOT CAUSE (founder meeting 2026-09-01, ~41 min, lost for >1 day): the durable recording is assembled by
-- stitching the live ~15s audio chunks into ONE file (src/lib/coach/v5/stitchSessionAudio.ts) — the only viable
-- path for a long session (a full-blob clean-Stop upload can't clear Vercel's ~4.5 MB request-body cap). But the
-- assets-v1 bucket's file_size_limit was 25 MB (0062, matched to the per-CLIENT-upload AGENT_MAX_BYTES). A 41-min
-- meeting stitches to ~37 MB, so storage REJECTED the upload ("object exceeded the maximum allowed size"); the
-- stitch never stamped audio_asset_url, and the review looped on "recording isn't ready" forever. Audio ~0.9
-- MB/min → the old cap silently made every session longer than ~27 minutes unrecoverable.
--
-- FIX: raise the BUCKET limit to 250 MB (~4.5 hours of audio) — headroom for any real meeting/call. This governs
-- only what STORAGE will accept; the per-client-upload cap (AGENT_MAX_BYTES, 25 MB, enforced in the route code)
-- is unchanged, so a browser still can't push a >25 MB blob directly — only the SERVER-SIDE stitch writes the
-- larger stitched file. No RLS/path change; the bucket stays private + company-scoped.

update storage.buckets
set file_size_limit = 262144000 -- 250 MB (was 26214400 / 25 MB)
where id = 'assets-v1';
