# CHECK — Mobile recording / voice-memo upload

## Verification runs (A38 — the canonical commands + their exit codes)

**Route + finalize-branch tests (new sign route + the updated upload-recording suite):**
```
$ npx vitest run "src/app/api/coach/sales-session/[id]/upload-recording"
 Test Files  2 passed (2)
      Tests  23 passed (23)
REAL_VITEST_EXIT=0
```
The 23 cases lock: the INV19 owner-or-manager gate on BOTH entry points (401 / 404 / 403-colleague /
200-owner / 200-manager), the multipart validation gate (400/413/exe), the JSON finalize gate (missing
storagePath 400, object-not-found 404, oversize-by-real-stored-size 413, non-media 400), the empty-stored-
content-type tolerance for a Files-app voice memo (200), and the recovery contract (audio/pointer persisted
FIRST → `audioSaved:true` + 502 on a transcription failure) on both branches.

**Whole-project typecheck (the new route, the JSON branch, the client rewire, both surfaces):**
```
$ npm run typecheck   # tsc --noEmit
TYPECHECK_EXIT=0
```

**Full gate** (`npm run check` = typecheck + lint + theme:audit + rls:audit + invariant:audit + tbc + test)
is run after these artifacts exist (tbc:artifacts validates the latest build dir); its pasted result +
exit code are recorded in closure.md.

## Proactive scan (§1.5.2 — think-first, then look at the adjacent surface)

- **INV19 on the pre-existing multipart path.** Looking at the route as a whole (not just my new branch),
  the ORIGINAL multipart `upload-recording` had NO owner check — a company colleague could attach a
  recording to (and read back the diarized content of) another rep's session, since `getSession` is
  company-scoped. Rather than gate only my new JSON branch (which would leave the multipart branch as an
  open bypass), I lifted the owner-or-manager gate to the SHARED entry so BOTH branches are covered. Closed
  within this build; locked by the new `403 for a colleague` test on both branches.
- **Recovery ordering.** Confirmed the JSON branch stamps `audio_asset_url` BEFORE transcription (same
  contract as the multipart branch + /retranscribe), so a voice memo whose STT fails is still recoverable.

## Findings

**No findings** — no open defects surfaced by verification. Known NON-defect limitations (honest scope
boundaries, not bugs):

1. **Exotic Android formats.** ElevenLabs Scribe decodes the common voice-memo formats (`.m4a`, `.mp3`,
   `.wav`, `.ogg`, `.mp4`/`.webm`); a rare `.amr`/`.3gp` may upload but fail to transcribe — which surfaces
   the honest "No speech was transcribed from that recording" (§3.4), not a silent empty. iPhone Voice Memos
   (`.m4a`) and mainstream Android recorders (`.m4a`) are fully covered.
2. **Large-file ceiling is plan-dependent.** The bucket cap is 25 MB and `maxDuration=300`, but Vercel Hobby
   clamps functions to 60s — a ~25 MB / ~25-min recording could time out on Hobby (the route already
   documents this; Pro honors 300s). The direct-to-storage UPLOAD always succeeds up to 25 MB; only the
   in-request transcription is plan-bounded.
3. **Client runtime is not unit-verifiable here.** `uploadToSignedUrl` from a real mobile browser (iOS
   Safari / Android Chrome file picker → Storage PUT) can't be exercised in this sandbox; it is locked by
   the route/wiring tests + the proven Files precedent, and the founder live-confirms on-device.
