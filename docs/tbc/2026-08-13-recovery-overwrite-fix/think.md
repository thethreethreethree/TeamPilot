---
tbc_version: 1
trigger: fix
started_at: 2026-08-13T23:55:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 14
hypotheses: 1
---

# THINK — fix the (broken) blank-read recovery stopgap: overwrite a 0-agent-turns transcript

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (record-check §1.2 — caught by self-verifying my own shipped code)
I shipped `BlankReadRecovery` (1728ee57) so a one-sided session (blank "Your read", composite signal present)
could re-transcribe from saved audio. Self-verifying it, I found it is BROKEN: the re-transcribe save goes
through `label-transcript`, which 409'd whenever ANY segments existed ("this session already has a transcript").
But a one-sided session HAS segments (customer/`unknown`), so the affordance showed and the save always 409'd →
recovered nothing. The affordance rendered only where it couldn't work (empty sessions hit a different branch).
A misleading live feature — my fault. Founder approved the fix: allow overwrite ONLY when the existing
transcript has ZERO agent turns.

## 3. The fix
`label-transcript` now keys the guard on agent turns, not mere existence:
- Existing transcript HAS an agent segment → CANONICAL → keep the 409 (never clobber a good transcript).
- Existing transcript has segments but ZERO agent turns → BROKEN read (one-sided / all-`unknown`), no "Your
  read" value, not canonical → delete those segments (`deleteSessionTranscriptSegments`, a new narrow,
  gated service-role delete) so the re-diarized segments don't collide on `unique(session_id, seq)` and no-op,
  then save the corrected transcript. Owner-only (unchanged gate). This is a narrow, deliberate exception to the
  append-only transcript rule (§3.1, the append-only rule): correcting a broken transcript is not a double-write, and a
  transcript with agent turns is still never touched.

## 4. Interconnections traced (§1.5.1)
- The `unique(session_id, seq)` constraint (0208) still prevents a doubled CANONICAL transcript; the delete only
  runs for 0-agent-turns transcripts. Concurrent recovery on ONE session is a manual, single-agent action, so
  the TOCTOU window the delete introduces is low-risk (whichever completes last yields a valid transcript) —
  same posture as the fast-fail check it replaces.
- Live coaching writes via `/finalize` + `/segments`, NOT this route, so no live save is affected.
- The stale header comment ("nothing is mutated") + the inline TOCTOU comment ("recovery only fires when empty")
  were corrected — they now describe the gated exception (don't mislead the next reader, F5 discipline).

## 5. Hypothesis (§1.5.2)
- **H1 — does keying the guard on `some(speaker==="agent")` correctly protect canonical transcripts while
  enabling recovery?** Yes: a transcript with ≥1 agent turn produces a real "Your read" (the review runs), so
  it's canonical → 409. A 0-agent-turns transcript yields EMPTY review (no read) → safe to replace. The test
  asserts both: agent-segment existing → 409 (no delete); customer/unknown-only existing → delete + save.
  CONFIRMED.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-13T23:55:05Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the failure from the record before patching — I verified my own shipped code broke.", "how_this_build_will_embody_it": "Traced the 409 in label-transcript before changing it; fix is scoped to the confirmed cause." },
  { "id": "§0.1", "read_at": "2026-08-13T23:55:10Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1)." },
  { "id": "§1.2", "read_at": "2026-08-13T23:55:15Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Record-check: the broken behavior was read from the actual route (the 409), not assumed.", "how_this_build_will_embody_it": "Read label-transcript + getSessionTranscript before the fix." },
  { "id": "§1.5.1", "read_at": "2026-08-13T23:55:20Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the delete touches the append-only invariant + the unique constraint + the live path.", "how_this_build_will_embody_it": "Section 4 traces the constraint, the live path, and the TOCTOU posture." },
  { "id": "§2", "read_at": "2026-08-13T23:55:25Z", "source_file": "CLAUDE.md", "line_range": "52-75", "why_it_governs": "Diagnose before patching + honesty — I shipped a broken feature and must fix it truthfully.", "how_this_build_will_embody_it": "Diagnosed the 409 root cause; surfaced the break to the founder before fixing." },
  { "id": "§3.1", "read_at": "2026-08-13T23:55:30Z", "source_file": "CLAUDE.md", "line_range": "196-210", "why_it_governs": "Append-only data architecture — the delete is an exception to it and must be narrow + justified.", "how_this_build_will_embody_it": "Delete gated to 0-agent-turns (non-canonical) transcripts only; canonical transcripts never touched." },
  { "id": "§1.5.2", "read_at": "2026-08-13T23:55:32Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive THINK-then-verify — I self-verified my own shipped stopgap rather than assume it worked.", "how_this_build_will_embody_it": "The adversarial self-check of the shipped code surfaced the 409 break (H1 confirmed against the route)." },
  { "id": "§5", "read_at": "2026-08-13T23:55:34Z", "source_file": "CLAUDE.md", "line_range": "300-320", "why_it_governs": "Honesty under pressure — I shipped a broken feature and must fix it truthfully, not paper over it.", "how_this_build_will_embody_it": "Surfaced the break to the founder before fixing; remediate.md states it plainly." },
  { "id": "§6", "read_at": "2026-08-13T23:55:35Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace what else the delete affects before shipping.", "how_this_build_will_embody_it": "Confirmed the constraint + live path + owner gate; test covers both branches." },
  { "id": "A19", "read_at": "2026-08-13T23:55:40Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the in-tree route before changing it.", "how_this_build_will_embody_it": "Read the whole label-transcript route + its test + appendTranscriptSegment before editing." },
  { "id": "A22", "read_at": "2026-08-13T23:55:45Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-13T23:55:50Z", "source_file": "ThinkerThinker.md", "line_range": "640-660", "why_it_governs": "Boundary/scope — apply the guard consistently, don't create a partial hole.", "how_this_build_will_embody_it": "Owner gate + the has-agent-turns check keep the delete narrowly scoped; no cross-user or canonical clobber." },
  { "id": "A30", "read_at": "2026-08-13T23:55:55Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the property with a test.", "how_this_build_will_embody_it": "The overwrite-vs-409 branch is locked by the updated route test (both cases)." },
  { "id": "A38", "read_at": "2026-08-13T23:56:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output + its exit code." }
]
```
