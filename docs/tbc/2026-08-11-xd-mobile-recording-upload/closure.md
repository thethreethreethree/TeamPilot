# CLOSURE — Mobile recording / voice-memo upload

## What shipped
1. **Direct-to-storage upload** — new `POST …/upload-recording/sign` mints a signed target; the browser
   PUTs bytes straight to Storage (`uploadToSignedUrl`); a JSON `{ storagePath }` finalize on
   `…/upload-recording` reads the real object, stamps `audio_asset_url`, and transcribes from storage.
   Bypasses the ~4.5 MB Vercel body cap → real 5–25 MB phone recordings / voice memos now work.
2. **Upload on every session + after it** — `SessionRecordingUpload` lifted out to BOTH experience modes
   on the live-session page, and added to the After-Pitch screen (both modes) with an `onLabeled` summary
   rebuild. Reverses the Standard p4/p5 removal per the founder's explicit pick.
3. **Voice-memo formats (Android + Apple)** — `accept` broadened (`.m4a/.caf/.amr/.3gp/.ogg/.wav/…`);
   the sign + finalize gates accept any `audio/`|`video/` and tolerate an empty stored content-type
   (a memo picked from Files); copy says "voice memo or call recording."
4. **Append-only double-write guard** (proactive §1.5.2 fix) — widening the upload surface exposed a
   double-append: `label-transcript` appends with no already-has-a-transcript check. Closed at two layers —
   the file-pick upload hides once `transcript.length === 0` is false, and `label-transcript` now returns 409
   `alreadyHasTranscript` if a transcript exists (§A30). Live coaching's `/finalize`+`/segments` untouched.
   See check.md + remediate.md.

## Un-named reliances this build silently rests on (A35 — name them so they're not a surprise later)
- **The ~4.5 MB Vercel serverless request-body limit is the load-bearing fact.** The entire fix exists
  because the multipart path routes bytes through the function body. If that platform limit ever changed,
  the direct path stays correct but the reason it was necessary would evaporate — the assumption is
  Vercel's, not ours, and is documented at `src/lib/storage/assets.ts:307`.
- **`getAssetObjectInfo` returns the REAL stored size/type.** The client-claimed size is untrusted; the
  413/400 gates depend on Supabase Storage `.list()` surfacing `metadata.size`/`mimetype`. If storage ever
  stops populating metadata, size reads 0 → treated as an empty upload → honest 400 (fails safe, not open).
- **ElevenLabs Scribe decodes the uploaded container.** Voice-memo support is real for `.m4a`/`.mp3`/`.wav`/
  `.ogg`; an exotic `.amr`/`.3gp` that Scribe can't decode surfaces "No speech was transcribed," never a
  silent empty.
- **In-request transcription is bounded by the Vercel plan tier.** `maxDuration=300` needs Pro; on Hobby a
  ~25-min recording would time out at 60s. The UPLOAD (direct-to-storage) is never plan-bounded; only the
  transcription call is. The escape hatch already exists: re-transcribe-from-storage (`/retranscribe`).
- **`isSalesCoachManager` correctly classifies the caller.** The INV19 gate trusts it to decide owner-vs-
  manager; a misclassification there would over- or under-gate. It is the same helper `/retranscribe` uses.
- **Client `uploadToSignedUrl` works from the mobile browser.** Unverifiable in this sandbox; rests on the
  proven Files upload precedent + the route/wiring tests. Founder live-confirms on-device.

## Continuity (L3)
Live session (both modes) → upload a phone recording → one-tap "which voice is you?" → transcript saved →
required naming gate → After-Pitch. From After-Pitch's "no conversation captured" dead end → upload right
there → `onLabeled` rebuilds the summary → the rep lands on a populated review. No dead end, no "upload it
on the other screen."

## Residual (A36 — what was skipped, ranked by confidence-it-does-not-matter; the top must be OPENED)
```json
[
  { "id": "R1", "item": "Whether any caller besides SessionRecordingUpload still POSTs MULTIPART to /upload-recording (the retained fallback branch).", "why_skipped": "The client was switched to the JSON direct-to-storage path; I grepped src for FormData/multipart callers of the route and found NONE — the multipart branch is now a pure back-compat fallback exercised only by its own tests, so keeping it costs nothing and breaks no caller.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-11T12:45:00Z", "outcome": "Confirmed no remaining multipart caller in src/ — the fallback branch is dead to the client and kept only for back-compat + its own boundary tests. No action needed." },
  { "id": "R2", "item": "The two advisory stale manifest line-ranges (§1.2, §3.2).", "why_skipped": "Advisory (F5), non-blocking. The validator matches the literal '§x' token, which for list-item §1.2 only appears in a cross-reference; I kept each citation pointed at the CONTENT I actually applied rather than distort it to appease the heuristic.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-11T12:40:00Z", "outcome": "Examined: the flagged lines are cross-references, not the principle text I applied; left the citations semantically honest rather than repoint to the token location. Advisory remains, intentionally." },
  { "id": "R3", "item": "Exact ElevenLabs Scribe decode matrix for exotic Android containers (.amr/.3gp).", "why_skipped": "Not empirically testable in this sandbox. Mainstream memo formats (.m4a/.mp3/.wav/.ogg) are covered; an undecodable container surfaces the honest 'No speech was transcribed' (§3.4), never a silent empty.", "confidence_it_does_not_matter": "medium", "opened_at": null },
  { "id": "R4", "item": "Real mobile-browser upload (uploadToSignedUrl from iOS Safari / Android Chrome file picker → Storage PUT).", "why_skipped": "No device/browser runtime in this sandbox; rests on the proven Files upload precedent + the route/wiring tests. Founder live-confirms on-device.", "confidence_it_does_not_matter": "low", "opened_at": null }
]
```

## Gate result (`npm run check`)
```
$ npm run check
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Files scanned: 766 · Violations: 0
tbc ✓ — tbc:docs · tbc:manifest · tbc:artifacts · tbc:residual · tbc:freshness all ✓
test ✓ — Test Files 385 passed | 1 skipped (386); Tests 2659 passed | 15 skipped (2674)
CHECK_EXIT=0
```

