---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T01:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 15
hypotheses: 1
---

# THINK — atomic-replace + 4 hardening fixes to the auto-recover build

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (record-check §1.2 — an adversarial review of the shipped auto-recover build)
I ran an independent adversarial review of the auto-recover feature (commit 812c2ce3) and record-checked each
finding against the code:
- **① HIGH (CONFIRMED):** the recovery overwrite is delete-then-append across two non-transactional calls. The
  delete result is guarded, but `appendTranscriptSegment` swallows errors, and the route returns
  `status:"recovered"` UNCONDITIONALLY. A transient DB error after a successful delete destroys the original
  transcript (which, for auto-recover, holds REAL agent speech — a §3.1 asset) and saves nothing/partial, while
  claiming success. A partial that lands an agent turn LOCKS the session (looks canonical → 409 forever).
- **② MEDIUM (CONFIRMED):** on the Expert mode-reconcile second `load()`, the auto-recover `if` is skipped
  (latch set) and the `else-if` heal fires an LLM re-gen on the same one-sided transcript — double cost +
  duplicate `after_pitch_summary_generated` KPI event.
- **③ MEDIUM (PLAUSIBLE):** cross-match can pick the wrong cluster if the live labels were polluted (customer
  mislabeled `agent` → knownAgentTurns mixes both voices → both clusters overlap → inversion).
- **④ LOW (CONFIRMED):** a transient STT failure consumes the once-only marker, permanently disabling automatic
  retry (manual card still works).
- **⑤ LOW (PLAUSIBLE):** a video session (mic is agent-only by design) is EXPECTED one-sided, so auto-recover
  fires a guaranteed-to-decline diarization.

## 3. The fixes (founder chose the transactional RPC for ①; ②–⑤ bundled)
- **① root fix:** `replace_session_transcript(session_id, segments)` RPC (0212) does delete+insert in ONE
  transaction. On any failure the whole thing rolls back — the original is never destroyed-and-unreplaced. Used
  by BOTH /auto-recover AND /label-transcript's overwrite branch (fixes the class at the root). The route
  returns `recovered` only on `ok`.
- **② share the latch:** the heal `else-if` also checks `autoRecoverAttemptedFor.current !== id`.
- **③ cross-match separation guard:** decide only when the runner-up is BELOW the similarity floor; two clusters
  both clearing it → decline (fall to content-tell / manual tap).
- **④ release the marker on transient STT/download failure** (kept for definitive outcomes).
- **⑤ skip auto-recover when `context === "video"`.**

## 4. Interconnections traced (§1.5.1)
- The RPC is SECURITY DEFINER + pinned search_path + service_role-only EXECUTE (not client-callable — it takes a
  tenant id; matches the invariant guard and the pilot_code function convention).
- /label-transcript keeps the plain 23505-idempotent append for the FIRST label (concurrent double-label of an
  empty transcript stays a safe no-op); only the OVERWRITE branch uses the atomic replace.
- ④'s marker release keeps the concurrency guard (claim before STT) while allowing retry after transient infra
  failures — a definitive outcome (recovered/declined) still leaves the marker set (no cost loop).
- ⑤ is gated at the page trigger (the session's `context`), so a video session never claims the marker or spends
  STT.

## 5. Hypothesis (§1.5.2)
- **H1 — does the atomic RPC eliminate the destroy-then-fail window?** Yes: a plpgsql function body is atomic to
  its calling statement, so if the insert fails the delete rolls back with it — the original transcript always
  survives a failed replace. The route returns `failed` (never a false `recovered`) on `!ok`. CONFIRMED by the
  route tests (replace fails → 500, no generation; original untouched).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T01:30:05Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the failure from the record before solving — the review findings were traced in code, not assumed.", "how_this_build_will_embody_it": "Each finding record-checked against the route/data layer before fixing." },
  { "id": "§0.1", "read_at": "2026-08-14T01:30:08Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1)." },
  { "id": "§1.2", "read_at": "2026-08-14T01:30:11Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective record-check of an adversarial review's claims.", "how_this_build_will_embody_it": "Confirmed ①②④ in code; marked ③⑤ plausible and guarded conservatively." },
  { "id": "§1.5.1", "read_at": "2026-08-14T01:30:14Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the RPC touches append-only, the unique constraint, both routes, and the security posture.", "how_this_build_will_embody_it": "Section 4 traces the DEFINER posture, the first-label append, marker semantics, video gate." },
  { "id": "§1.5.2", "read_at": "2026-08-14T01:30:16Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-verify — the atomicity claim is confirmed against the plpgsql semantics + tests.", "how_this_build_will_embody_it": "H1 stated then confirmed by the failing-replace route tests." },
  { "id": "§2", "read_at": "2026-08-14T01:30:19Z", "source_file": "CLAUDE.md", "line_range": "52-75", "why_it_governs": "Diagnose before patching + honesty (no false 'recovered').", "how_this_build_will_embody_it": "Root-caused the destroy-then-fail window; the route now reports failed honestly." },
  { "id": "§3.1", "read_at": "2026-08-14T01:30:22Z", "source_file": "CLAUDE.md", "line_range": "196-210", "why_it_governs": "Append-only data architecture — the overwrite is a narrow, now-ATOMIC exception.", "how_this_build_will_embody_it": "Delete+insert in one transaction; the original always survives a failed replace." },
  { "id": "§3.4", "read_at": "2026-08-14T01:30:25Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Honesty — no false success; no confident wrong attribution.", "how_this_build_will_embody_it": "status:recovered only on ok; cross-match declines on ambiguity." },
  { "id": "§5", "read_at": "2026-08-14T01:30:28Z", "source_file": "CLAUDE.md", "line_range": "300-320", "why_it_governs": "Distrust the shipped-and-green feeling — I adversarially reviewed my own just-shipped code.", "how_this_build_will_embody_it": "The review found a HIGH bug the test suite had passed over; fixed at the root." },
  { "id": "§6", "read_at": "2026-08-14T01:30:31Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple before shipping.", "how_this_build_will_embody_it": "Both routes + the page + the RPC security traced; tests updated." },
  { "id": "A18", "read_at": "2026-08-14T01:30:34Z", "source_file": "ThinkerThinker.md", "line_range": "430-452", "why_it_governs": "Data-integrity — the RPC writes the canonical transcript; must not be client-callable.", "how_this_build_will_embody_it": "EXECUTE granted to service_role only; routes gate owner + precondition first." },
  { "id": "A19", "read_at": "2026-08-14T01:30:37Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the in-tree routes + the function convention before mirroring.", "how_this_build_will_embody_it": "RPC follows the pilot_code DEFINER + search_path + revoke/grant convention." },
  { "id": "A22", "read_at": "2026-08-14T01:30:40Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-14T01:30:43Z", "source_file": "ThinkerThinker.md", "line_range": "640-660", "why_it_governs": "Scope — fix the class consistently across both overwrite paths.", "how_this_build_will_embody_it": "auto-recover AND label-transcript overwrite both use the atomic RPC." },
  { "id": "A30", "read_at": "2026-08-14T01:30:46Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate each fix with a test.", "how_this_build_will_embody_it": "replace-fails→500 (both routes), cross-match-ambiguity→decline, are each locked by a test." },
  { "id": "A38", "read_at": "2026-08-14T01:30:49Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = command + output.", "how_this_build_will_embody_it": "closure.md pastes the full-gate output + exit code." }
]
```
