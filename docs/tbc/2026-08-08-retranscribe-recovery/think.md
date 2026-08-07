---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T04:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 16
hypotheses: 3
---

# THINK — Re-transcribe recovery for orphaned recordings

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429 lines) + ThinkerThinker.md (0428…, 1039 lines) MATCH the top-level
DOC_MANIFEST.json exactly (hash + line count). Both are in the working tree; the cited clauses
were re-read this session (manifest in section 7).

## 2. Diagnosis (§1.2 retrospective / §0 understand-before-solving)
During the ElevenLabs STT outage (the "Token mint failed" escalation), `/upload-recording` behaved
per its own §3.4-honest error path: it PERSISTED the audio (`audio_asset_url` stamped) and only THEN
called diarization, which 502'd. Result — a well-defined **orphaned state**: the recording exists in
storage, but the transcript never landed. Four such recordings from 2026-08-07 were verified present in
storage (blobs intact, dated that day). The audio is not lost; it is stuck.

The pre-existing recovery required the rep to **re-upload the original file** — a file a door-to-door
rep on their phone may no longer have. That is a workflow dead-end (§1.5.1 layer 3): the system is
holding everything it needs to recover, but the only path asks the human to supply what the server
already has.

## 3. Request (founder-authorized this build via AskUserQuestion — "Re-transcribe recovery")
Add a manager/owner-gated path that re-transcribes from the ALREADY-STORED audio, so an orphaned
session recovers without a re-upload. It must reuse the existing labeling/append path, not invent a
second transcript-write.

## 4. Interconnection trace (§1.5 holistic)
- The write of the transcript is append-only (§3.1) and must stay single-sourced. `/label-transcript`
  is the ONLY sanctioned appender and it is already latch-guarded against double-write. Therefore the
  new route must NOT append — it returns `{segments,speakers}` (the exact `/upload-recording` shape) and
  hands off to the existing speaker-tap → `/label-transcript` flow. Zero new write path.
- `audio_asset_url` has THREE writers that disagree on its shape (documented in `recording-purge-cron`):
  bucket-relative `${ASSETS_BUCKET}/…` vs a full URL. A recovery that mis-parses this would download the
  wrong object or reject a valid one. Centralize the parse (`assetUrlToStoragePath`) so download/sign/purge
  agree, and treat an unrecognized pointer as "leave it alone" (422), never "use the raw string as a path".
- `getSession` is COMPANY-scoped, not owner-scoped (INV19). The route returns call CONTENT, so it must add
  an owner-OR-manager gate — a colleague must not pull another rep's call via a shared company.
- The re-transcribe button must be offered ONLY when a transcript does NOT already exist, or labeling would
  append a DUPLICATE transcript onto a populated one (the append-only double-write class).

## 5. Spec fidelity (build as authorized)
Build AS AUTHORIZED: a recovery route that sources audio from storage and feeds the existing tap flow.
No deviation from the framework. The append-avoidance and the owner-or-manager gate are not deviations —
they are the framework (§3.1 append-only single-writer; INV19 owner check) applied to the new seam.

## 6. Hypotheses (§1.5.2 — before search)
- **H1 (write-path duplication risk):** if the route appended segments itself, a re-transcribe on a session
  that already has a transcript would double-write the record. Confirm: does any code path let this route
  reach `appendTranscriptSegment`? Search → it does not; it returns segments only, and the UI gates the
  affordance on `transcript.length === 0`. **Held.**
- **H2 (tenant leak):** a company-scoped `getSession` alone would let a colleague re-transcribe another rep's
  call. Confirm: is there an owner/manager check between `getSession` and the download? Search the finalize
  route's INV19 precedent → mirrored here (owner-or-manager). **Held.**
- **H3 (pointer mis-parse):** a full-URL `audio_asset_url` (the purge-cron "malformed" shape) must not be fed
  to storage as a path. Confirm: `assetUrlToStoragePath` returns null for non-bucket-relative → 422, no
  download. Tested. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T04:00:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — characterize the orphaned state from the record before building recovery.", "how_this_build_will_embody_it": "Section 2 defines the orphaned state (audio present, transcript absent) from the verified 4 recordings before any code." },
  { "id": "§0.1", "read_at": "2026-08-08T04:00:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH; each cited clause carries a this-session read below." },
  { "id": "§1.2", "read_at": "2026-08-08T04:00:00Z", "source_file": "CLAUDE.md", "line_range": "54-60", "why_it_governs": "Retrospective identification — characterize the orphaned state from the actual record (4 verified recordings), not by theorizing forward.", "how_this_build_will_embody_it": "Section 2 reads the reproduced outage behavior and locates the audio-present/transcript-absent state it produced." },
  { "id": "§3.3", "read_at": "2026-08-08T04:00:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — flag the cron DRY follow-up rather than silently refactoring the retention path.", "how_this_build_will_embody_it": "closure.md flags the cron dedup as residual RES-01, not an in-scope edit." },
  { "id": "§3.4", "read_at": "2026-08-08T04:00:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — a transcription failure must read as an honest retryable state, not a lie about lost audio.", "how_this_build_will_embody_it": "On a 502 the route returns audioSaved:true; the button only appears when audio genuinely exists." },
  { "id": "§1.5.1", "read_at": "2026-08-08T04:00:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer feature gate — the pre-walk (build.md) checks structure→effect→continuity→surface; layer 3 is the whole point (re-upload was a dead-end).", "how_this_build_will_embody_it": "build.md walks all four layers; the recovery restores workflow continuity, not just correctness." },
  { "id": "§1.5.2", "read_at": "2026-08-08T04:00:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesize the failure classes (duplication, tenant leak, pointer parse) before grepping.", "how_this_build_will_embody_it": "Section 6 states H1-H3 with the confirming search; each resolved before build." },
  { "id": "§1.5", "read_at": "2026-08-08T04:00:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — the new route touches shared storage, the append-only transcript, and tenant scope.", "how_this_build_will_embody_it": "Section 4 traces each seam and keeps the transcript single-writer." },
  { "id": "§3.1", "read_at": "2026-08-08T04:00:00Z", "source_file": "CLAUDE.md", "line_range": "257-270", "why_it_governs": "Events are append-only — the transcript must have one sanctioned writer.", "how_this_build_will_embody_it": "The route does NOT append; it reuses /label-transcript, the single latch-guarded appender." },
  { "id": "§6", "read_at": "2026-08-08T04:00:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks understood-why, retrospective, ripple trace, holistic/organic, explain-why." },
  { "id": "§5", "read_at": "2026-08-08T04:00:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — build the authorized feature well (tested, no fabrication), not fast-and-loose.", "how_this_build_will_embody_it": "The recovery reuses the tested append path and adds real route+unit tests, not a shortcut." },
  { "id": "A19", "read_at": "2026-08-08T04:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read this session before citation." },
  { "id": "A22", "read_at": "2026-08-08T04:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T04:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate.", "how_this_build_will_embody_it": "assetUrlToStoragePath + the route's owner/append contract are locked by tests that fail without them." },
  { "id": "A31", "read_at": "2026-08-08T04:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "791-920", "why_it_governs": "Schema-complete is not built — assert the write↔read seam, not the file inventory.", "how_this_build_will_embody_it": "check.md asserts both directions: human can trigger (button) and human can see (transcript renders)." },
  { "id": "A38", "read_at": "2026-08-08T04:00:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, reported with exit code.", "how_this_build_will_embody_it": "check.md pastes `npm run check` coverage + exit 0." }
]
```
