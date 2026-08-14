---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T07:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — /finalize server-side idempotency (stop re-charging 5 LLM engines)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) in-tree, hashes verified. Cited amendments read in
ThinkerThinker.md this session; CLAUDE.md §§ in-context.

## 2. Why (record-check §1.2 — CONFIRMED against both routes)
Spend hole-hunt, confirmed against the code:
- **F1 (finding ⑨, MED):** `/finalize` calls `generateSessionArtifacts` — five concurrent DeepSeek engines
  (dissect + summary + moments + pivot + intel) — UNCONDITIONALLY. The only guard is the client `finalizedRef`
  (useLiveCoaching), which is per-mount. A second POST (a 2nd tab, a retry, a future caller) re-charges all five.
  The transcript append is idempotent (unique (session_id, seq)); the LLM generation is NOT. Its sibling
  `/label-transcript` IS protected (409 on a canonical transcript); finalize had no equivalent server gate.

## 3. The fix
Skip the five-engine generation when the dissect already landed — the SAME `coach.sales_review`… no: the SAME
`coach.dissect_generated` marker the backfill cron keys on. Before generating, read (RLS, owner's own session
event) whether a `coach.dissect_generated` event exists for `sales_session:<id>`; if so, append the transcript
(idempotent) and return `{ alreadyGenerated: true }` WITHOUT re-charging. A FAILED first generation leaves no
marker, so a legitimate retry still runs.

## 4. Interconnections traced (§1.5)
- The transcript append stays BEFORE the guard, so a finalize that arrives with new streamed segments still
  persists them even when generation is skipped (append is idempotent on seq).
- The client fires finalize fire-and-forget (`void fetch`, useLiveCoaching:737) and ignores the response, so the
  new `alreadyGenerated` shape breaks nothing.
- Uses the RLS `supabase` client for the marker read (the owner reading their own session's dissect event — the
  dashboard route reads events the same way), so no service-role widening.
- The generation path itself (generateSessionArtifacts, the per-engine timeouts, the response flags) is unchanged
  on the FIRST finalize.

## 5. Hypothesis (§1.5.2)
- **H1 — does a second finalize (dissect already present) skip the five engines?** Yes: the finalize route test
  asserts that with a prior `coach.dissect_generated`, `runAndStoreDissect` is NOT called and the response is
  `alreadyGenerated:true`, while a first finalize (no marker) DOES run it.

## Out of scope (deferred follow-up — finding ④, retranscribe)
`/retranscribe` also lacks server idempotency (a reload / 2nd tab / on-mount auto-fire re-runs a full STT
diarization = a duplicate STT charge). It is NOT bundled here because the fix is genuinely different: retranscribe
is RE-RUNNABLE BY DESIGN (a manual recovery), and its diarization result is EPHEMERAL (returned to the client for
labeling, never persisted) — so de-duping without re-charging needs new persisted state (a cached diarization
result, or a per-session auto-fire marker column = a migration), which should not be rushed into a cost path this
deep in a long session. Flagged for a dedicated build with that approach.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T07:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the re-charge from the record — read both routes + the client finalize call before changing anything.", "how_this_build_will_embody_it": "Confirmed finalize calls generateSessionArtifacts unconditionally + the client void-fetches it, before adding the guard." },
  { "id": "§0.1", "read_at": "2026-08-14T07:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified; amendments read in-session." },
  { "id": "§1.2", "read_at": "2026-08-14T07:01:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — the dissect marker already EXISTS in the record (the backfill keys on it); reuse it rather than inventing new state.", "how_this_build_will_embody_it": "Guarded finalize on the same coach.dissect_generated marker the backfill cron already uses." },
  { "id": "§1.5", "read_at": "2026-08-14T07:01:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the guard must not drop new streamed segments, must not break the fire-and-forget client, must not widen to service-role.", "how_this_build_will_embody_it": "Section 4 keeps the append before the guard, verifies the client ignores the response, uses the RLS client." },
  { "id": "§1.5.1", "read_at": "2026-08-14T07:02:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-1/2 — a paid engine re-run for one user action is a structural cost defect, not a surface issue; fix it at the route, the right depth.", "how_this_build_will_embody_it": "Server-side marker guard at the route (not a client band-aid), mirroring label-transcript's server gate." },
  { "id": "§1.5.2", "read_at": "2026-08-14T07:02:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-verify: the unconditional re-charge was hypothesised from the agent, CONFIRMED by reading the route before fixing.", "how_this_build_will_embody_it": "H1 gated by the finalize route test." },
  { "id": "§6", "read_at": "2026-08-14T07:03:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (append order, client consumer, RLS vs service-role, first-finalize path).", "how_this_build_will_embody_it": "All enumerated in Section 4." },
  { "id": "A19", "read_at": "2026-08-14T07:03:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read finalize + retranscribe + the client + the backfill marker pattern before editing." },
  { "id": "A22", "read_at": "2026-08-14T07:04:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendments read in ThinkerThinker.md this session." },
  { "id": "A26", "read_at": "2026-08-14T07:04:30Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "A finding is one instance of a class — but retranscribe's instance needs a different (migration) fix; don't force one mechanism onto both.", "how_this_build_will_embody_it": "Fixed the tractable no-server-idempotency instance (finalize) with the existing marker; flagged retranscribe's ephemeral-result instance for a dedicated build with the right approach." },
  { "id": "A30", "read_at": "2026-08-14T07:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "The finalize test asserts the 5 engines are skipped when the dissect marker exists — removing the guard reddens CI." },
  { "id": "A38", "read_at": "2026-08-14T07:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit 0." }
]
```
