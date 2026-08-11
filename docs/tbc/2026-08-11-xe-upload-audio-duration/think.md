---
tbc_version: 1
trigger: fix
started_at: 2026-08-11T14:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 2
---

# THINK — Uploaded recording shows the real audio length, not the session wall-clock

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes unchanged.

## 2. The bug (founder-reported during a live client test, 2026-08-11)
An uploaded call recording ("Test Voice Recording upload") showed **"62m 47s conversation"** for a ~4-minute
audio file. Screenshot on the After-Pitch header.

## 3. Retrospective root cause (§1.2) — read the code, not a theory
`durationLabel(start, end)` in the After-Pitch page = `ended_at − started_at` (the session WALL-CLOCK). For a
LIVE coaching session that IS the conversation length (start = talk begins, end = talk ends) and stays
correct. For an UPLOADED recording, `started_at` is when the rep opened the session and `ended_at` is when
they named/finished it — so the "duration" is just **how long the session sat open** (~62 min here), which has
nothing to do with the 4-min audio. The real length lives in the audio and was being discarded: the Scribe
transcription response carries per-word `start` timestamps, but `transcribeWithDiarization` only kept the
speaker/text.

## 4. Fix (§3.5 measurement honesty — measure the real conversation, never a fabricated number)
Capture the real audio length from the Scribe word timestamps and store it, so the displayed + measured
duration reflects the recording, not the session window:
- `transcribeWithDiarization` now returns `{ segments, durationSeconds }` (durationSeconds = the last spoken
  word's end/start, rounded).
- `upload-recording` (JSON + multipart) and `retranscribe` stamp `coaching_sessions.audio_duration_seconds`
  after a successful transcription (best-effort second update).
- Migration 0210 adds the nullable `audio_duration_seconds` column (additive, non-locking).
- After-Pitch `durationLabel` PREFERS `audioDurationSeconds` when present; live sessions (null) fall back to
  the wall-clock, which is correct there.

## 5. Hypotheses (§1.5.2 think-first)
- **H1 — could break live-coaching duration.** → No: live sessions never set `audio_duration_seconds` (only
  upload/retranscribe do), so `durationLabel` falls back to the wall-clock exactly as before. CONFIRMED.
- **H2 — migration coupling (A34).** → The read uses `getSession`'s `.select("*")` (returns the column if
  present, maps to null if not — degrades cleanly). The write is an UNCHECKED best-effort update (a failed
  update on a missing column is silently ignored, never thrown). Migration applied BEFORE deploy regardless.
  CONFIRMED A34-safe.

## 6. Decision checklist (§6)
Understood (root cause read from the code, not guessed); precedent reused (mirrors the existing stamp-after-
transcribe ordering); ripple traced (3 transcription callers + session type + mapper + display; KPI compute
NOT yet switched — named as a residual); gated by tests (duration stamp asserted in the upload route tests).
Migration additive + applied via `npm run db:apply` (verify:live: all 26 invariants hold).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-11T14:31:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understanding precedes solving — read WHY the duration is wrong before changing it.", "how_this_build_will_embody_it": "Traced durationLabel = wall-clock from the code; the fix targets the actual cause (discarded audio timestamps)." },
  { "id": "§0.1", "read_at": "2026-08-11T14:31:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-11T14:32:00Z", "source_file": "CLAUDE.md", "line_range": "52-60", "why_it_governs": "Retrospective identification from the record.", "how_this_build_will_embody_it": "Root cause is the wall-clock durationLabel, read directly, not theorized." },
  { "id": "§1.5.1", "read_at": "2026-08-11T14:52:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic solutioning — never fix one surface in a way that leaves another silently broken; trace the ripple across every place the value appears.", "how_this_build_will_embody_it": "Fixed the duration in ALL THREE surfaces (After-Pitch, Sessions list, KPI) so an upload can't read 4m in one place and 62m in another." },
  { "id": "§1.5.2", "read_at": "2026-08-11T14:52:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit — THINK first about where else the bug manifests, then search to confirm.", "how_this_build_will_embody_it": "Grepped every started_at/ended_at consumer; found three duration surfaces + confirmed salesElo is ordering-only." },
  { "id": "§3.4", "read_at": "2026-08-11T14:33:00Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty is the moat — the system must never present a fabricated or misleading number as if it were real, and a 62m duration for a 4m clip is exactly that kind of dishonest surface.", "how_this_build_will_embody_it": "Every duration consumer returns null/'—' when neither a real audio length nor a valid wall-clock exists — a made-up duration is never shown." },
  { "id": "§3.5", "read_at": "2026-08-11T14:33:30Z", "source_file": "CLAUDE.md", "line_range": "294-310", "why_it_governs": "Measurement rules — meeting/conversation DURATION is a hard metric; it must be the REAL length.", "how_this_build_will_embody_it": "Stores + displays the actual audio length for uploads, not the session open-time." },
  { "id": "§6", "read_at": "2026-08-11T14:34:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The quick decision checklist forces understanding, retrospective + outside-view, ripple-tracing, and holistic-vs-local before any substantive action.", "how_this_build_will_embody_it": "Section 6 answers each item; it drove tracing the ripple to all three duration surfaces and confirming A34 migration-coupling safety before writing." },
  { "id": "A19", "read_at": "2026-08-11T14:31:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree this session.", "how_this_build_will_embody_it": "Re-read the after-pitch duration path + the transcription in-tree before changing them." },
  { "id": "A22", "read_at": "2026-08-11T14:34:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A30", "read_at": "2026-08-11T14:36:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the class in a test, don't leave the invariant to prose or the UI.", "how_this_build_will_embody_it": "The duration stamp is asserted in the upload route tests; avgSessionDurationMin's prefer-audio-length is locked by a KPI compute test that reads 4m not 62m." },
  { "id": "A34", "read_at": "2026-08-11T14:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "870-896", "why_it_governs": "Migration-coupled code must DEGRADE (reads) + fail honestly (writes), never hard-require.", "how_this_build_will_embody_it": "Read via .select(*) → null-safe; write is unchecked best-effort → silent no-op if absent; migration applied before deploy." },
  { "id": "A38", "read_at": "2026-08-11T14:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + its output.", "how_this_build_will_embody_it": "check.md pastes the vitest + db:apply/verify:live runs with exit codes." }
]
```
