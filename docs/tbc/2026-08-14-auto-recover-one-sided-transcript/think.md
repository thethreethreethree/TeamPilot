---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T00:50:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 15
hypotheses: 2
---

# THINK — automatic recovery of a one-sided (customer-missing) After-Pitch

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (record-check §1.2 — from the founder's screenshot, not a guess)
A real 6-minute session ("Knute roleplay") produced a blank "Your read" + missing graded scores. The screen
carries a decodable fingerprint: **TALK/LISTEN "—"** is emitted by exactly one path — `computeTalkRatio`
returns `display:"—"` with `caveat:true` iff `custW === 0` (salesScore.ts:132) — and **QUESTIONS "10 of 10"**
means `computeQuestionRate` counted 10 agent turns. So: agent side captured, customer side missing → a
one-sided transcript. The LLM review + graded scores had one side to work from → blank read + only the two
deterministic computed scores survived. This is the same live STT/attribution capture gap that is the spine of
the no-feedback thread, missing the CUSTOMER side this time instead of the agent's.

My first instinct (reasoning-model token starvation) was overruled by the evidence: a starved model leaves
talk/listen intact because both sides are still transcribed. The "—" proves capture, not starvation (§5 —
distrust the fast, well-sourced answer; the finding follows the data).

## 3. The fix (founder-approved: "auto re-transcribe on detection")
When the After-Pitch is opened and the transcript is detected one-sided (talk_ratio caveat) with saved audio,
the SERVER automatically re-diarizes the saved recording cleanly offline (no 700ms live constraint → both
voices recovered), AUTO-ASSIGNS the agent cluster (no rep tap), replaces the broken transcript, and
regenerates. Bounded to at most one STT batch per affected session by an atomic marker.

Foundation-up: `autoSpeakerAssign` (pure agent-cluster decision) → `captureGap` (detection) → migration 0211
(marker) → `/auto-recover` endpoint → after-pitch page trigger + manual fallback.

## 4. Interconnections traced (§1.5.1)
- **Cannot reuse /label-transcript**: it 409s any transcript with an agent turn (canonical), and the
  customer-missing transcript HAS agent turns. So /auto-recover owns its overwrite precondition = the
  talk_ratio caveat (`repW>0 && custW===0`); a two-sided transcript stays canonical and is never clobbered.
- **Owner-only** (not owner-or-manager like /retranscribe): it WRITES the canonical transcript via the service
  role, so it matches /label-transcript's A18 poisoning guard.
- **At-most-once**: 0211's `auto_recover_attempted_at` claimed by an ATOMIC conditional UPDATE before any STT
  cost — a reload, or a persistently one-sided audio, can't loop the batch STT. A client latch alone is
  insufficient (resets on reload).
- **No double generation**: `generateSessionArtifacts` (server after()) produces dissect/conversation-summary/
  moments/pivot/intel — NOT the After-Pitch summary (POST /after-pitch). So the client's `generate()` on
  `recovered` rebuilds only the read; no duplicate `after_pitch_summary_generated` KPI event. Mirrors the
  manual recovery flow exactly.
- **Delete-guard**: /auto-recover checks `deleteSessionTranscriptSegments`'s boolean → 500 on failure, never
  appends onto surviving seqs (the Frankenstein class fixed the same day in /label-transcript).
- **Auto-recover ordered BEFORE the auto-heal** in load(): the customer-missing gap also satisfies
  afterPitchNeedsHeal, but a heal just re-runs the LLM on the same one-sided transcript. Recovering first gives
  the rebuilt read both sides.

## 5. Hypotheses (§1.5.2)
- **H1 — is the blank read a capture gap (customer missing) rather than starvation?** Yes: talk/listen "—" =
  `custW===0` (customer side has no words) while 10 agent turns scored. Starvation would leave talk/listen a
  real ratio. CONFIRMED from the screenshot + salesScore.ts.
- **H2 — can auto-assignment recover the agent WITHOUT saving a wrong label?** Yes for the customer-missing
  case: the live agent turns are ground truth, and cross-match (overlap coefficient) picks the matching
  cluster; when neither cross-match nor content-tells are confident, it DECLINES (`decided:false`) and the rep
  taps manually — a wrong confident label is never written. CONFIRMED by autoSpeakerAssign's tests (ambiguous /
  single-cluster / coin-flip all decline).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T00:50:05Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the failure from the record before solving.", "how_this_build_will_embody_it": "Diagnosed from the screenshot fingerprint (talk/listen '—') before designing." },
  { "id": "§0.1", "read_at": "2026-08-14T00:50:10Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1)." },
  { "id": "§1.2", "read_at": "2026-08-14T00:50:15Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Record-check: read the actual code paths, not assumed.", "how_this_build_will_embody_it": "computeTalkRatio/computeQuestionRate read directly to decode the screen." },
  { "id": "§1.5.1", "read_at": "2026-08-14T00:50:20Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the write touches append-only, the marker, the live path, generation.", "how_this_build_will_embody_it": "Section 4 traces label-transcript, the marker, generation disjointness, delete-guard, heal ordering." },
  { "id": "§1.5.2", "read_at": "2026-08-14T00:50:22Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive THINK-then-verify: form the hypothesis about the failure and the fix FIRST, then confirm it against the actual code + tests rather than assuming the cause.", "how_this_build_will_embody_it": "Hypotheses H1/H2 stated then confirmed against salesScore.ts + autoSpeakerAssign's tests." },
  { "id": "§2", "read_at": "2026-08-14T00:50:25Z", "source_file": "CLAUDE.md", "line_range": "52-75", "why_it_governs": "Diagnose before patching.", "how_this_build_will_embody_it": "Root cause pinned from evidence before any code." },
  { "id": "§3.1", "read_at": "2026-08-14T00:50:30Z", "source_file": "CLAUDE.md", "line_range": "196-210", "why_it_governs": "Append-only — the recovery delete is a narrow exception.", "how_this_build_will_embody_it": "Delete gated to the one-sided (talk_ratio caveat) precondition; canonical transcripts never touched." },
  { "id": "§3.4", "read_at": "2026-08-14T00:50:33Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Honesty — no fabricated attribution; no false capture-gap diagnosis.", "how_this_build_will_embody_it": "autoSpeakerAssign declines rather than guess; the card copy names the missing side by direction." },
  { "id": "§5", "read_at": "2026-08-14T00:50:35Z", "source_file": "CLAUDE.md", "line_range": "300-320", "why_it_governs": "Distrust the fast answer.", "how_this_build_will_embody_it": "Rejected the starvation snap-diagnosis when the '—' evidence contradicted it." },
  { "id": "§6", "read_at": "2026-08-14T00:50:37Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple + workflow continuity.", "how_this_build_will_embody_it": "Auto-recover leaves the rep with a rebuilt read (flowing state), manual card as fallback." },
  { "id": "A18", "read_at": "2026-08-14T00:50:40Z", "source_file": "ThinkerThinker.md", "line_range": "430-452", "why_it_governs": "Data-integrity — owner-only write, no cross-user injection.", "how_this_build_will_embody_it": "/auto-recover is owner-only (agentId === user.id), matching /label-transcript." },
  { "id": "A19", "read_at": "2026-08-14T00:50:43Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the in-tree routes before mirroring.", "how_this_build_will_embody_it": "Read /retranscribe + /label-transcript + generateSessionArtifacts before building." },
  { "id": "A22", "read_at": "2026-08-14T00:50:45Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-14T00:50:48Z", "source_file": "ThinkerThinker.md", "line_range": "640-660", "why_it_governs": "Scope — apply the guard consistently, no partial hole.", "how_this_build_will_embody_it": "Owner gate + caveat precondition + atomic marker keep the write narrowly scoped." },
  { "id": "A30", "read_at": "2026-08-14T00:50:52Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the verified property with a test so a future edit can't silently regress it.", "how_this_build_will_embody_it": "Every load-bearing property (owner-only, canonical-never-clobbered, at-most-once STT, never-save-a-wrong-label, delete-guard) is locked by a test in build.md's coverage list." },
  { "id": "A38", "read_at": "2026-08-14T00:50:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = command + output.", "how_this_build_will_embody_it": "closure.md pastes the full-gate output + exit code." }
]
```
