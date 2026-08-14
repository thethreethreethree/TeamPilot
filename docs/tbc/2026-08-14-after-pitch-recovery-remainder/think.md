---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T07:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — After-Pitch recovery remainder: stale-blank-on-reload + single-voice false-promise loop

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) in-tree, hashes verified. Cited amendments read in
ThinkerThinker.md this session; CLAUDE.md §§ in-context.

## 2. Why (record-check §1.2 — CONFIRMED against the route + page)
The two remaining gaps in customer-missing After-Pitch recovery (deferred from the earlier build, now fixed):
- **F1 (finding ⑥, MED):** after a SUCCESSFUL server recovery whose CLIENT `generate()` is lost (rep navigates /
  drops network in the window after "recovered" returns), the stored After-Pitch stays the OLD blank
  customer-missing read. On reload the transcript is now two-sided, so auto-recover returns 409 `canonical` — and
  the client just set `autoRecoverResolved` and did NOT regenerate, so the stale blank persisted forever.
- **F2 (finding ⑧, MED):** a genuine single-voice decline (`single-cluster`) returned `still-one-sided` but did
  NOT persist WHY. On reload the marker was already set, so the route returned the generic `already-attempted` →
  the client then offered a "re-transcribe" card that re-runs STT, reproduces the one voice, and dead-ends at
  `/label-transcript` (which 409s a single-speaker transcript). A false-promise loop the `still-one-sided`
  terminal was created to prevent.

## 3. The fix
- **F1 (client, no double-charge):** in `autoRecover()`, handle the `canonical` status — the transcript is
  already two-sided, so regenerate the After-Pitch from it. This heals the stale blank exactly once (the
  regenerated read is two-sided → the next visit detects no capture gap → no re-fire), and does NOT add a
  server-side generation (which would race the client's own post-recovery `generate()` and double-charge).
- **F2 (server, event-based, no migration):** on a `single-cluster` decline, append a
  `coach.auto_recover_declined` event; at the `already-attempted` branch (the reload path, marker already set),
  read that event and return `still-one-sided` instead — so the reload renders the honest terminal, never the
  re-transcribe card. NOT written for `ambiguous` (that one can still be retried manually).

## 4. Interconnections traced (§1.5)
- F1 fires ONLY when the stored summary is customer-missing AND the transcript is canonical — i.e. the
  lost-client case; a normally-recovered session (fresh two-sided summary stored) never detects a gap, so it
  never re-fires. No double-generation.
- F2's decline event is COARSE (reason only, no scores) — company-visible like the other coach events, no A18
  leak. The marker semantics are unchanged; only the `already-attempted` response is refined by the decline read.
- The atomic replace, the at-most-once claim, the transient-release (finding ⑦), and the first-visit engage
  (finding ②) from the prior builds are all untouched.

## 5. Hypothesis (§1.5.2)
- **H1 — does a single-voice decline stay honest across a reload, and does a lost-client recovery self-heal?**
  Yes: the route test asserts a single-cluster decline PERSISTS `coach.auto_recover_declined` and a reload
  (marker set + prior decline) returns `still-one-sided` (not `already-attempted`, no STT re-charge); ambiguous
  does NOT persist. F1's canonical→regenerate is a client page effect (repo convention: 0 *.test.tsx) — a
  browser repro is the honest check (residual).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T07:30:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand both gaps from the record — trace the client autoRecover() response handling + the route's decline/already-attempted branches before changing them.", "how_this_build_will_embody_it": "Confirmed the client ignores canonical + the route loses the decline reason on reload, before editing." },
  { "id": "§0.1", "read_at": "2026-08-14T07:30:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified; amendments read in-session." },
  { "id": "§1.2", "read_at": "2026-08-14T07:31:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — read the actual response branches + the storage model (append-versioned summaries) to pick a heal that doesn't double-charge.", "how_this_build_will_embody_it": "Chose the client canonical→regenerate over a server after() generation precisely because the storage is append-versioned and a server gen would race the client." },
  { "id": "§1.5", "read_at": "2026-08-14T07:31:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the heal must not double-generate, must not re-fire on a healthy session, must not leak scores, must not disturb the marker semantics.", "how_this_build_will_embody_it": "Section 4 shows each: single-fire heal, coarse decline event, unchanged marker." },
  { "id": "§1.5.1", "read_at": "2026-08-14T07:32:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-3 continuity — a stale blank read and a re-transcribe dead-end both strand the rep; the fix must leave them at a real read or an honest terminal.", "how_this_build_will_embody_it": "Reload heals to a real read (F1) or an honest single-voice terminal (F2), never a false-promise card." },
  { "id": "§1.5.2", "read_at": "2026-08-14T07:32:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-verify: both gaps hypothesised from the agent, CONFIRMED by reading the branches before fixing.", "how_this_build_will_embody_it": "H1 gated by the route test (F2); F1 flagged as a browser residual honestly." },
  { "id": "§6", "read_at": "2026-08-14T07:33:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (double-generation, healthy-session re-fire, A18, marker semantics).", "how_this_build_will_embody_it": "All enumerated in Section 4." },
  { "id": "A19", "read_at": "2026-08-14T07:33:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read the route, the page, and the summary storage model before editing." },
  { "id": "A22", "read_at": "2026-08-14T07:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendments read in ThinkerThinker.md this session." },
  { "id": "A26", "read_at": "2026-08-14T07:34:30Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "A finding is one instance of a class — the customer-missing recovery flow had four instances; this closes the last two after ② + ⑦.", "how_this_build_will_embody_it": "With ②/⑦ (prior build) + ⑥/⑧ (here), the first-visit, transient-burn, stale-reload, and single-voice-loop gaps are all closed." },
  { "id": "A30", "read_at": "2026-08-14T07:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "The route test locks: single-cluster persists a decline; a reload with a prior decline returns still-one-sided (no STT); ambiguous does not persist." },
  { "id": "A38", "read_at": "2026-08-14T07:35:30Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit 0." }
]
```
