---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T03:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — stop the dissect-backfill re-running a full LLM on stuck no-signal sessions forever

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (record-check §1.2 — a confirmed HIGH finding from this session's audit)
`runAndStoreDissect` (salesDissect.ts:132) stores `coach.dissect_generated` ONLY when `hasSignal`. So a session
with agent turns (≥ MIN → it RUNS the ~20s LLM) that yields NO signal — starved (F3 corpus), tone-law-rejected
(growth but no strengths), or genuinely empty-with-turns — stores nothing, stays "missing" in
`runDissectBackfill` (dissectBackfill.ts:88 filters on the generated event), and is **re-run with a full LLM
call every pass forever**. The daily cron (cap 12) burns its budget on the same stuck sessions; the MANUAL
"Generate missing" button (told to "run until remaining=0") can NEVER reach 0 when ≥ cap stuck sessions exist —
each click is a fresh ~6× LLM batch of immediate metered spend, and completion is unreachable. Verified fresh
against the code (salesDissect.ts:132, dissectBackfill.ts:88, dissect is controlExempt so never suppressed).
Real recurring metered $. Founder chose the backoff-marker fix (N=14).

## 3. The fix
- `runAndStoreDissect`: when the LLM RAN (agent turns ≥ MIN) but produced NO signal, emit a
  `coach.dissect_attempted` event (append-only; events.kind is free text — no schema change). Best-effort.
- `runDissectBackfill`: exclude sessions with a `coach.dissect_attempted` event in the last 14 days (queried the
  same bounded way as the generated events, on the indexed `occurred_at`). A stuck session leaves the `missing`
  set → `remaining` reaches 0, the button completes, the cron stops re-spending — and the session re-enters
  after 14 days so a later corpus-trim can still recover it.

## 4. Interconnections traced (§1.5)
- `coach.dissect_attempted` is NOT in `signal_sources` (0005), so the derivation trigger finds no match → no
  signal derived, no error. events.kind is unconstrained text → the insert is accepted.
- The emit fires ONLY for the LLM-ran-no-signal case: `hasSignal` → `dissect_generated` (unchanged); thin (0
  agent turns, no LLM) → NOTHING (a cheap re-check next pass is fine, no cost to bound).
- Both the cron and the manual button share `runDissectBackfill`, so one fix closes both paths (the manual
  amplifier — unreachable "remaining=0" — is fixed by the same exclusion).
- The backoff query mirrors the existing dissect-event query's bounded `.in("subject", subjects)` discipline
  (never a full events scan).

## 5. Hypothesis (§1.5.2)
- **H1 — does the attempted marker converge the backfill?** Yes: a no-signal-but-ran session gets the marker →
  excluded for 14 days → `missing` shrinks → `remaining` reaches 0 and the LLM isn't re-run. CONFIRMED by the
  tests: runAndStoreDissect emits `dissect_attempted` on no-signal-with-turns (not on thin); runDissectBackfill
  skips a recently-attempted session (only s1/s3 processed, s2 backed off).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T03:00:05Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the loop from the record before fixing — traced the store condition + the missing-filter.", "how_this_build_will_embody_it": "Confirmed salesDissect.ts:132 + dissectBackfill.ts:88 in code before changing them." },
  { "id": "§0.1", "read_at": "2026-08-14T03:00:08Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1)." },
  { "id": "§1.2", "read_at": "2026-08-14T03:00:11Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective record-check of a confirmed HIGH finding, re-verified against the current code.", "how_this_build_will_embody_it": "Re-read salesDissect + dissectBackfill; confirmed the loop still holds." },
  { "id": "§1.5", "read_at": "2026-08-14T03:00:14Z", "source_file": "CLAUDE.md", "line_range": "78-110", "why_it_governs": "Holistic — the new event kind touches the derivation trigger + both backfill callers.", "how_this_build_will_embody_it": "Section 4 traces signal_sources (no match → no signal), both callers, the bounded query." },
  { "id": "§1.5.1", "read_at": "2026-08-14T03:00:15Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Workflow continuity (layer 3) — the admin's 'run until remaining=0' workflow must actually be able to complete, not stall forever.", "how_this_build_will_embody_it": "The backoff makes remaining reach 0, so the manual button completes and leaves the admin in a flowing (done) state." },
  { "id": "§1.5.2", "read_at": "2026-08-14T03:00:16Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive THINK-then-verify: state the convergence hypothesis (the marker drains the missing set) FIRST, then confirm it against the emit + backfill tests rather than assuming it.", "how_this_build_will_embody_it": "H1 stated + confirmed by both test files (emit cases + the backoff-skip)." },
  { "id": "§3.1", "read_at": "2026-08-14T03:00:19Z", "source_file": "CLAUDE.md", "line_range": "196-210", "why_it_governs": "Append-only event architecture — the fix ADDS an event, never mutates.", "how_this_build_will_embody_it": "coach.dissect_attempted is an append-only event; state (backoff) is derived by reading it." },
  { "id": "§3.4", "read_at": "2026-08-14T03:00:22Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Honesty — the manual button's 'run until remaining=0' must become truthful.", "how_this_build_will_embody_it": "With the backoff, remaining reaches 0 and the button completes honestly." },
  { "id": "§5", "read_at": "2026-08-14T03:00:25Z", "source_file": "CLAUDE.md", "line_range": "300-320", "why_it_governs": "Cost discipline — a loop that re-spends metered LLM budget forever is the failure to close.", "how_this_build_will_embody_it": "The backoff bounds the spend to one attempt per session per 14 days." },
  { "id": "§6", "read_at": "2026-08-14T03:00:28Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace the ripple (derivation, both callers).", "how_this_build_will_embody_it": "Confirmed no derivation break; both callers converge." },
  { "id": "A19", "read_at": "2026-08-14T03:00:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read runAndStoreDissect + runDissectBackfill + the events schema (0004/0005) before editing." },
  { "id": "A22", "read_at": "2026-08-14T03:00:31Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-14T03:00:34Z", "source_file": "ThinkerThinker.md", "line_range": "640-660", "why_it_governs": "Scope — emit ONLY for the LLM-ran-no-signal case, not thin sessions.", "how_this_build_will_embody_it": "The emit is gated on agent-turns ≥ MIN; thin sessions emit nothing." },
  { "id": "A30", "read_at": "2026-08-14T03:00:37Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the property with a test.", "how_this_build_will_embody_it": "runAndStoreDissect.emit.test.ts (emit cases) + dissectBackfill.test.ts (backoff exclusion)." },
  { "id": "A38", "read_at": "2026-08-14T03:00:40Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = command + output.", "how_this_build_will_embody_it": "closure.md pastes the full-gate output + exit code." }
]
```
