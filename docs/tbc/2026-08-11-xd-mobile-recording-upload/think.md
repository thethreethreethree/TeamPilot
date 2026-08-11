---
tbc_version: 1
trigger: feature
started_at: 2026-08-11T12:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 19
hypotheses: 3
---

# THINK — Mobile recording / voice-memo upload, on every session + after it

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in the working tree, hashes unchanged
vs DOC_MANIFEST.json. Session-read manifest at the foot.

## 2. Spec, restated (§3.2 fidelity)
Founder (option picker, 2026-08-11) chose, then clarified across three messages:
1. **Standard mode → "Everywhere, incl. after the call."** Upload must be reachable on the Standard
   (door-to-door) live-session screen AND the After-Pitch screen — reversing the earlier spec p4/p5
   removal ("door-to-door people won't use this"). Expert already has it on every session.
2. **Mobile → "Proper fix — direct-to-storage."** Real phone recordings must upload.
3. **"accept voice memos from mobile phone android and apple" / "so the upload system can accept this
   file format."** Apple Voice Memos = `.m4a`; Android recorders = `.m4a`/`.amr`/`.3gp`/`.ogg`/`.wav`.

## 3. Retrospective root cause (§1.2) — why uploads "disappeared"
The founder's uploaded recordings kept vanishing / erroring ("No speech was transcribed"). Reading the
record, not theorizing: `upload-recording/route.ts` takes the file through `req.formData()` — i.e. through
the **Vercel serverless function body, hard-capped at ~4.5 MB** (documented at
`src/lib/storage/assets.ts:307`). A 10-min Voice Memo `.m4a` is already ~5 MB; a 30-min call ~25 MB. So
every real recording died at the platform layer BEFORE the route's own 25 MB check ran. This is not an
ElevenLabs problem (that was last incident) — it is a body-size architecture problem. Separately, in
**Standard** mode the upload UI was intentionally removed (Expert-only `{!isStandard && …}` block), and an
ended Standard session redirects to After-Pitch which had no upload — so even a working upload was
unreachable for the door-to-door rep after the call.

## 4. Precedent check (A28) — reuse the Files direct-to-storage mechanism verbatim
The codebase ALREADY solves ">4.5 MB from the browser": the **Files** feature signs a target
(`/api/files/upload-url` → `createSignedUploadTarget`), the client PUTs bytes direct to Storage
(`supabase.storage.from(bucket).uploadToSignedUrl`), then POSTs metadata + `storagePath` to `/api/files`
which reads the REAL object size via `getAssetObjectInfo` (client-claimed size is untrusted). I mirror
this exactly for the recording upload — **but validate manually** (size + `audio/`|`video/` MIME +
executable-ext block), NOT `validateUploadCandidate`, because that helper's BLOCKED_EXTENSIONS rejects
`.webm`/`.mp4` (legit recording formats) — the existing `upload-recording` route documents this at line 101.
The transcribe-from-storage step reuses `retranscribe`'s proven path (download bytes → transcribeWithDiarization).

## 5. Hypotheses (§1.5.2 think-first)
- **H1 — breaking the live-coaching auto-upload.** The live blob (`initialBlob`) shares `uploadBlob`. →
  Routing it through direct-to-storage too is strictly MORE capable (a long in-person live recording also
  exceeds 4.5 MB today and silently fails). The multipart route branch is KEPT as a guarded fallback so
  existing tests + any other caller stay green. Designed-in.
- **H2 — INV19 content exposure.** The finalize branch RETURNS transcript segments (call content). A
  colleague sharing the company must not pull another rep's call. → Gate finalize + sign owner-or-manager,
  mirroring `retranscribe` (`reference_company_scoped_getsession_needs_owner_check`).
- **H3 — voice-memo MIME rejected.** iOS/Android sometimes hand a file with empty or unusual MIME. → The
  route defaults `file.type || "audio/webm"` (passes the `audio/` gate); the finalize branch re-checks the
  REAL `getAssetObjectInfo().contentType` and tolerates a null/empty content-type as audio. `accept`
  broadened with explicit extensions so extension-only pickers surface the memo.

## 6. Four-layer trace (§1.5.1)
- **L1 (structure):** one upload mechanism (the Files signed-URL pattern), not a second bespoke one; the
  transcribe step reuses retranscribe's download-from-storage; the UI reuses the existing
  `SessionRecordingUpload` component — surfaced in more places, not re-implemented.
- **L2 (effectivity):** a real 5–25 MB phone recording / voice memo actually uploads and transcribes end
  to end — the thing that is broken today.
- **L3 (continuity):** after upload → one-tap "which voice is you?" → transcript saved → `onLabeled` rebuilds
  the After-Pitch summary, leaving the rep on a populated review, not a dead end. On After-Pitch the
  empty-state copy now points at the upload right there, not "on the session screen afterward."
- **L4 (surface):** the same ember card + LearningHint; copy says "voice memo or call recording."

## 7. Decision checklist (§6)
Understood (founder picks + the §1.2 4.5 MB root cause read from the record); precedent reused (A28 — Files
signed-URL); ripple traced (live blob → same path; the Standard removal is a documented founder decision I
surfaced + got explicit reversal before touching); gated by tests (A30 — sign auth/validation + finalize
branch). Client RUNTIME-UNVERIFIED on a real device — locked by wiring/route tests; founder live-confirms on
their phone.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-11T12:01:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "The One Law — understanding precedes solving; earn the diagnosis before the fix.", "how_this_build_will_embody_it": "Diagnosed the ~4.5 MB serverless-body root cause from the record before writing any upload code (why uploads vanished, not a guess)." },
  { "id": "§0.1", "read_at": "2026-08-11T12:02:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition before a substantive build.", "how_this_build_will_embody_it": "Governing-doc hashes verified against DOC_MANIFEST; manifest reflects this session's reads." },
  { "id": "§1.2", "read_at": "2026-08-11T12:05:00Z", "source_file": "CLAUDE.md", "line_range": "47-60", "why_it_governs": "Retrospective identification — find the ACTUAL cause from the record, not a forward guess.", "how_this_build_will_embody_it": "Read the upload route + assets.ts:307; the 4.5 MB serverless body cap is the real reason uploads vanished, not ElevenLabs." },
  { "id": "§1.5.1", "read_at": "2026-08-11T12:06:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer L3 continuity — upload must leave the rep on a populated review, not a dead end.", "how_this_build_will_embody_it": "onLabeled rebuilds the After-Pitch summary; empty-state copy points at the in-place upload." },
  { "id": "§1.5.2", "read_at": "2026-08-11T12:06:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Think-first about how the change could break the live-coaching path + expose content.", "how_this_build_will_embody_it": "H1/H2/H3 formed and answered before writing." },
  { "id": "§2", "read_at": "2026-08-11T12:04:00Z", "source_file": "CLAUDE.md", "line_range": "175-205", "why_it_governs": "Surface, don't overtake — the Standard removal was a documented founder decision.", "how_this_build_will_embody_it": "Surfaced the intentional removal + got explicit reversal via the option picker before reversing it." },
  { "id": "§3.2", "read_at": "2026-08-11T12:04:30Z", "source_file": "CLAUDE.md", "line_range": "230-240", "why_it_governs": "Build the spec as written.", "how_this_build_will_embody_it": "Upload on Standard live + After-Pitch (both modes); direct-to-storage; voice-memo formats." },
  { "id": "§3.4", "read_at": "2026-08-11T12:07:00Z", "source_file": "CLAUDE.md", "line_range": "270-295", "why_it_governs": "Honesty — no silent empties.", "how_this_build_will_embody_it": "Oversized/empty/unreadable uploads error with an actionable message; the audio is persisted before transcription so a failed STT is recoverable." },
  { "id": "§6", "read_at": "2026-08-11T12:08:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Pre-action checklist forces precedent + ripple-trace + gate-or-promise.", "how_this_build_will_embody_it": "Section 7 answers each item; drove reusing Files + gating owner-or-manager." },
  { "id": "A18", "read_at": "2026-08-11T13:10:00Z", "source_file": "ThinkerThinker.md", "line_range": "429-451", "why_it_governs": "The transcript is the human-behavior record a coach/manager reviews; its integrity is the structural defense — a doubled/mixed transcript corrupts every downstream read + score.", "how_this_build_will_embody_it": "The append-only double-write guard (UI gate + label-transcript 409) keeps the reviewed record single and trustworthy." },
  { "id": "A19", "read_at": "2026-08-11T12:02:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "The governing methodology must be consulted from the working tree this session, not cached memory.", "how_this_build_will_embody_it": "Re-read the upload route + assets.ts + the Files precedent in-tree this session before mirroring; doc hashes verified present." },
  { "id": "A22", "read_at": "2026-08-11T12:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Constitutional citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's actual reads; the minimum set (§0, A19, A22) is present." },
  { "id": "A28", "read_at": "2026-08-11T12:03:00Z", "source_file": "ThinkerThinker.md", "line_range": "735-760", "why_it_governs": "Reuse precedent before inventing.", "how_this_build_will_embody_it": "Mirrored the Files signed-URL upload (sign → uploadToSignedUrl → finalize w/ getAssetObjectInfo)." },
  { "id": "A30", "read_at": "2026-08-11T12:07:30Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the class, don't leave it in prose.", "how_this_build_will_embody_it": "sign route + finalize branch covered by vitest (auth/validation/owner-gate/oversize); the double-write class gated by the label-transcript 409 test, not just the UI." },
  { "id": "A31", "read_at": "2026-08-11T12:09:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-820", "why_it_governs": "Schema-complete is not built — the DB↔surface seam must be gated, both paths asserted.", "how_this_build_will_embody_it": "build.md asserts write-path AND read-path for each of the 3 features." },
  { "id": "A33", "read_at": "2026-08-11T13:12:00Z", "source_file": "ThinkerThinker.md", "line_range": "850-896", "why_it_governs": "When a gate can't be precise, name the hole and decline rather than fake precision.", "how_this_build_will_embody_it": "The label-transcript TOCTOU self-race is named + declined in remediate.md/closure.md (single-writer reality), not row-locked." },
  { "id": "A35", "read_at": "2026-08-11T13:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "898-919", "why_it_governs": "Name the un-headlined reliance; silence dodges the citation hook.", "how_this_build_will_embody_it": "closure.md names the 4.5MB-cap / getAssetObjectInfo / Scribe-decode / plan-tier / mobile-client reliances." },
  { "id": "A36", "read_at": "2026-08-11T13:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "921-945", "why_it_governs": "The residual is the highest-yield queue; the top-confidence entry must be OPENED, not disclaimed.", "how_this_build_will_embody_it": "closure.md residual R1 (highest confidence) was actually opened (grepped for multipart callers) with a recorded outcome." },
  { "id": "A38", "read_at": "2026-08-11T12:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + its output.", "how_this_build_will_embody_it": "check.md pastes the vitest + typecheck runs with exit codes." }
]
```
