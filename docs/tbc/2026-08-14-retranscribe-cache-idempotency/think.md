---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T08:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — /retranscribe idempotency: cache the diarization (stop the reload STT re-charge)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) in-tree, hashes verified. Cited amendments read in
ThinkerThinker.md this session; CLAUDE.md §§ in-context.

## 2. Why (record-check §1.2 — CONFIRMED against the route + the client auto-fire)
Spend hole-hunt, confirmed against the code:
- **F1 (finding ④, HIGH):** `/retranscribe` runs a full batch STT diarization with NO server idempotency — the
  only guards are client refs (`retranscribingRef`, `autoRetranscribedRef`), which reset on remount. So a page
  reload, a 2nd tab, or the on-mount AUTO-fire (`autoRetranscribe`) re-downloads + re-diarizes the ENTIRE
  recording = a full duplicate STT charge, every time. It is the single most cost-dense repeatable charge in the
  product (the whole recording, not a per-turn cost).

Founder decision (2026-08-14): fix by CACHING the diarization result (chosen over a per-session auto-fire marker,
which would only guard the auto path).

## 3. The fix
The audio for a session is fixed, so its diarization is effectively fixed → cache it.
- **Migration 0213** adds `coaching_retranscribe_cache` (session_id PK, company_id, `audio_asset_url`, `result`
  jsonb). RLS ENABLED, NO policies — service-role-only (the care_visitor_presence pattern); the 4 ops are
  allowlisted in scripts/rls-audit.mjs with reasoning. It is a CACHE, not an append-only asset — replaced on a
  forced re-diarize, self-invalidated on a new recording.
- **Route:** before STT, read the cache (admin) and return it WITHOUT STT when it exists AND was produced from
  the session's CURRENT `audio_asset_url` (self-invalidation — a re-upload changes the pointer → stale → miss →
  re-diarize). `?force=1` bypasses the cache for a deliberate refresh. After STT, upsert the result keyed on the
  session PK.

## 4. Interconnections traced (§1.5)
- SELF-INVALIDATION via the stored `audio_asset_url` avoids adding an invalidation hook at every audio-write
  site (upload-recording, live-persist) — a missed hook there would serve a stale diarization; the compare can't
  be missed.
- The cache holds call content (the diarized segments), gated exactly like the route already gates its response:
  the route authorizes owner-or-manager (INV19) and reads/writes via the service-role admin client; RLS is
  service-role-only so a member can never read the cache directly (A18 — no wider exposure than the route).
- On a `dl`/STT failure the route returns 502 BEFORE the cache write, so a failed diarization is never cached
  (a later retry re-attempts). The duration stamp + the labeling flow (/label-transcript) are unchanged.
- No coaching_sessions column added (its many `.select("*")` reads would have pulled the large blob) — a
  dedicated table keeps those queries lean.

## 5. Hypothesis (§1.5.2)
- **H1 — does a repeat retranscribe for the SAME recording skip STT?** Yes: the route test asserts a cache HIT
  (matching audio pointer) returns the stored result with NO `transcribeWithDiarization` / download; a MISS or a
  STALE pointer (a new recording) re-diarizes + caches; `?force=1` re-diarizes despite a valid cache.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T08:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the re-charge + the client auto-fire from the record before changing the route or adding a table.", "how_this_build_will_embody_it": "Read the route + the SessionRecordingUpload auto-fire + the storage model before choosing the cache design." },
  { "id": "§0.1", "read_at": "2026-08-14T08:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified; amendments read in-session." },
  { "id": "§1.2", "read_at": "2026-08-14T08:01:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — mirror the existing service-role-only table pattern (care_visitor_presence / after_pitch_summaries) rather than invent RLS.", "how_this_build_will_embody_it": "Read 0080 + the rls-audit allowlist; the cache uses the proven service-role-only pattern." },
  { "id": "§1.5", "read_at": "2026-08-14T08:01:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — a cache must self-invalidate on a new recording, never cache a failure, never widen access, never bloat the hot coaching_sessions reads.", "how_this_build_will_embody_it": "Section 4: pointer self-invalidation, cache-after-success-only, service-role RLS, dedicated table." },
  { "id": "§1.5.1", "read_at": "2026-08-14T08:02:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-1 — a repeated full-recording STT charge is a structural cost defect; the durable fix is a cache at the DB layer, not a client band-aid.", "how_this_build_will_embody_it": "Server-side cache keyed on the recording; the client refs stay as a same-mount latch but no longer bear the cost guarantee." },
  { "id": "§1.5.2", "read_at": "2026-08-14T08:02:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-verify: the reload re-charge was hypothesised from the agent, CONFIRMED by reading the route + the auto-fire before fixing.", "how_this_build_will_embody_it": "H1 gated by the route test (hit/miss/stale/force)." },
  { "id": "§6", "read_at": "2026-08-14T08:03:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (invalidation, failure-not-cached, RLS, hot-read bloat, migration ledger).", "how_this_build_will_embody_it": "All enumerated in Section 4; migration applied via db:apply (never hand-applied)." },
  { "id": "A19", "read_at": "2026-08-14T08:03:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read the route, the auto-fire, the storage model, and the after_pitch_summaries RLS before editing." },
  { "id": "A22", "read_at": "2026-08-14T08:04:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendments read in ThinkerThinker.md this session." },
  { "id": "A26", "read_at": "2026-08-14T08:04:30Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "A finding is one instance of a class — this closes the retranscribe instance of the no-server-idempotency class (finalize was the other, closed earlier).", "how_this_build_will_embody_it": "With finalize (finding ⑨) + retranscribe (④), the paid-generation paths guarded only by a client latch are both closed." },
  { "id": "A30", "read_at": "2026-08-14T08:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "The route test locks: a cache hit skips STT; a stale pointer / force re-diarizes; the rls-audit allowlist locks the service-role-only access." },
  { "id": "A38", "read_at": "2026-08-14T08:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output (+ db:apply for the migration).", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit 0 and the db:apply result." }
]
```
