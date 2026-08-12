---
tbc_version: 1
trigger: feature
started_at: 2026-08-12T10:10:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 2
---

# THINK — capture-cost dashboard (answers the founder's "determine the cost of this issue")

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (an explicit founder requirement + "please continue")
The founder's capture-incident message asked to "determine the cost of this issue"; they then said "please
continue". I already provided a Supabase SQL query (immediate answer), but the founder wants it in-app. This is
the manager-facing number: how many ended sessions failed to capture a transcript, split into recoverable
(audio saved → re-transcribable) vs lost (no audio — only possible before the build-xp persist fix).

## 3. The build
- **Route** `GET /capture-health` (manager-gated, read-only): exact head count of ended sessions (`total`);
  page the ended rows (id, audio_asset_url) + the segment session_ids (batched ≤1000 ids, each paged via
  fetchAllPaged); a session with no segment = failed; split by audio_asset_url → recoverable/lost.
- **UI**: a manager-only "Capture health" card on Settings → Coaching (beside the Voice-health card), a
  "Check" button → the counts.

## 4. Scale honesty (§3.4) — the deliberate limitation
This counts in the APP, not via a server-side aggregate. Correct at first-client scale; past fetchAllPaged's
200k backstop it THROWS → the route returns a 500 that says "volume too large for an in-app count (a
server-side aggregate is the fix)". That is honest, not a silent wrong number. The RIGHT long-term tool is an
RPC (a migration) — deliberately NOT built here: a migration is consequential + gated to the founder's
db:apply, and a secure RPC (INVOKER/no-tenant-param, per the client-callable-DEFINER invariant) is not worth
rushing deep in a long session for a number the SQL already answers. The in-app version serves the incident
(low-volume first client) with an honest ceiling.

## 5. Record check (§1.2) — reuse, don't reinvent
Mirrors the existing manager-gated read-only diagnostic pattern (voice-health route + card) and the KPI routes'
fetchAllPaged usage (A16). No new backend concepts.

## 6. Hypotheses (§1.5.2)
- **H1 — does the batching handle >1000 ended sessions?** Yes: the ended ids are sliced into ≤1000-id batches
  before each `.in()` (the PostgREST ceiling), and each batch's rows are paged. CONFIRMED by the code + the
  derivation test.
- **H2 — can a failed count read as "zero failures"?** No: a read error throws → the route returns 500 with a
  clear message, never a fabricated 0 (§3.4). The honest-zero path only fires when total===0. CONFIRMED by the
  test (honest zero) + the catch.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T10:10:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand the requirement + reuse before building.", "how_this_build_will_embody_it": "Section 5 reuses the voice-health diagnostic pattern + fetchAllPaged." },
  { "id": "§0.1", "read_at": "2026-08-12T10:10:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-12T10:11:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Reuse the established pattern, not a new one.", "how_this_build_will_embody_it": "Mirrors voice-health (manager read-only diagnostic) + KPI fetchAllPaged." },
  { "id": "§1.5.1", "read_at": "2026-08-12T10:11:20Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer — the count is only useful if correct (layer 2) and honest at its ceiling.", "how_this_build_will_embody_it": "Batched+paged for correctness; fail-loud past the backstop." },
  { "id": "§1.5.2", "read_at": "2026-08-12T10:11:35Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive — think the >1000 + error paths before building.", "how_this_build_will_embody_it": "H1/H2 cover batching + error-not-zero." },
  { "id": "§3.4", "read_at": "2026-08-12T10:11:50Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — a count that can't be computed must say so, not show 0.", "how_this_build_will_embody_it": "500 with a clear message on failure; honest zero only when total===0." },
  { "id": "§6", "read_at": "2026-08-12T10:12:05Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — reuse + holistic before acting.", "how_this_build_will_embody_it": "Sections 3-5." },
  { "id": "A16", "read_at": "2026-08-12T10:10:45Z", "source_file": "ThinkerThinker.md", "line_range": "381-390", "why_it_governs": "Reuse the diagnostic + paging patterns, don't fork.", "how_this_build_will_embody_it": "Mirrors voice-health + fetchAllPaged." },
  { "id": "A19", "read_at": "2026-08-12T10:10:50Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree this session.", "how_this_build_will_embody_it": "Read the voice-health route + fetchAllPaged + the KPI routes in-tree before mirroring them." },
  { "id": "A22", "read_at": "2026-08-12T10:12:20Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads; minimum set present." },
  { "id": "A30", "read_at": "2026-08-12T10:12:35Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the lesson in a test.", "how_this_build_will_embody_it": "Route test locks the failed/recoverable/lost derivation + the manager gate + honest zero." },
  { "id": "A38", "read_at": "2026-08-12T10:12:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check.md pastes the vitest + npm run check with exit codes." }
]
```
