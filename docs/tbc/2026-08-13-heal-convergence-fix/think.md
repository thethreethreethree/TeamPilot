---
tbc_version: 1
trigger: fix
started_at: 2026-08-13T23:25:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 1
---

# THINK — after-pitch heal convergence fix (regression in the F1 fix)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why
The F1 read-heal fix (`3b44945b`) keyed the after-pitch auto-heal on `!existing.narrative.hasSignal` so a
starved blank read re-generates. An adversarial review (spawned to independently check my own session fixes,
per the documented pattern that agents catch the builder's blind spots) found a CONFIRMED regression: my
justification ("scores ⟺ agent turns, so a blank narrative with a true composite is always a starved read")
ignored TWO of the composite's four terms. Verified against the code (§1.2 — a finding is a suspect, confirmed
before fixing):
- `afterPitch.ts:160` composite = `narrative.hasSignal || moments || scores || cueLoop`.
- `salesMoments.ts:54` gates on `MIN_SEGMENTS = 1` counting ANY speaker (not agent) → a one-sided /
  customer-only recording (rep mic not captured → 0 agent turns) still produces moments.
- `cueLoop` (afterPitch.ts) comes from live cues — transcript-speaker-independent.
- `salesReview.ts:67` returns EMPTY_REVIEW deterministically (no LLM) when `agentSegments < MIN_AGENT_SEGMENTS`;
  `salesScore.ts:182` returns EMPTY on the same condition.
So a one-sided recording: narrative deterministically blank + scores empty + moments/cueLoop present →
composite true → stored `{hasSignal:true, narrative:{hasSignal:false}}`. My heal fired `!narrative.hasSignal`
→ re-generate → narrative AGAIN blank (0 agent turns, deterministic) → composite AGAIN true → NEVER converges.
Bounded once-per-mount by the ref, but EVERY fresh navigation/reload re-fires a full 4-engine generation →
unbounded LLM spend + a read the heal falsely promises to fix. One-sided recordings are REALISTIC — the
founder's agents use mobile, where the rep mic is often not captured.

## 3. The fix
Gate the narrative-heal clause on `existing.scores.length > 0`. `scores` is present IFF there is ≥1 agent turn
(salesScore returns EMPTY only below MIN_AGENT_SEGMENTS), so it is an EXACT proxy for "the read is recoverable":
- Starved (agent turns → scores present, narrative blank): heal → 7000-budget re-gen → converges. ✓
- One-sided (0 agent turns → scores empty, narrative blank, composite true via moments/cueLoop): NO heal — the
  read is correctly blank and unrecoverable; the summary still renders its moments/scores/cueLoop. ✓
- Genuinely empty (0 signal): composite false → the `!hasSignal` clause (unchanged) handles it; generate() is a
  cheap no-op there (all engines short-circuit without LLM). ✓

## 4. Residual (stated, not hidden)
A real call WITH agent turns whose review returns growth areas but ZERO strengths collapses to
narrative.hasSignal:false via the tone law (`salesReview.ts:153`) while scores stay present → this heal
re-fires per visit. That is rare (a real pitch almost always yields ≥1 strength; re-gen usually resolves it)
and retrying to obtain a tone-law-valid read is semi-desirable; the same is true of persistent F3 corpus
starvation. Bounded per-visit, tied to F3 (corpus-trim, founder-gated). Not the confirmed realistic bug, which
this fix closes. A durable once-per-session heal marker would close the residual too — deferred as over-reach
for a rare case (would add a browser-API-throws surface for little gain).

## 5. Hypothesis (§1.5.2)
- **H1 — does `scores.length > 0` exactly separate recoverable from unrecoverable blanks?** Yes:
  `scores` non-empty ⟺ `agentSegments ≥ MIN_AGENT_SEGMENTS` (salesScore.ts:181-182), and `salesReview`
  short-circuits to EMPTY on the identical condition (salesReview.ts:67-70). So scores-present ⟺ the review
  engine WOULD run ⟺ a blank read is a starved (recoverable) read. CONFIRMED against both engines.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-13T23:30:00Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the regression from the record before fixing — the review finding is a suspect, verified.", "how_this_build_will_embody_it": "Confirmed all four cited facts (salesReview/salesMoments/salesScore/afterPitch) before changing the predicate." },
  { "id": "§0.1", "read_at": "2026-08-13T23:30:05Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1)." },
  { "id": "§1.2", "read_at": "2026-08-13T23:30:10Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Record-check: verify the agent's finding against the actual engines before fixing.", "how_this_build_will_embody_it": "Read salesReview.ts:67, salesMoments.ts:54, salesScore.ts:182, afterPitch.ts:160 to confirm the loop." },
  { "id": "§1.5.1", "read_at": "2026-08-13T23:30:15Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 effectivity: the heal must actually converge, not just fire.", "how_this_build_will_embody_it": "The fix makes the heal converge (or correctly not fire), not merely trigger." },
  { "id": "§2", "read_at": "2026-08-13T23:30:20Z", "source_file": "CLAUDE.md", "line_range": "52-75", "why_it_governs": "No error loops — a repeated failing action means the identification was wrong.", "how_this_build_will_embody_it": "The literal defect IS a non-converging loop; the fix re-diagnoses (composite has 4 terms, not 1)." },
  { "id": "§1.5.2", "read_at": "2026-08-13T23:30:25Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive independent review caught the builder's blind spot.", "how_this_build_will_embody_it": "Acted on the adversarial finding + added the convergence regression test." },
  { "id": "§6", "read_at": "2026-08-13T23:30:30Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace the other composite terms before re-shipping.", "how_this_build_will_embody_it": "Traced moments/cueLoop as the composite-true drivers on 0-agent-turn sessions." },
  { "id": "A30", "read_at": "2026-08-13T23:30:35Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the property with a test.", "how_this_build_will_embody_it": "The one-sided-recording case is now a detection test (would loop pre-fix, no-heal post-fix)." },
  { "id": "A19", "read_at": "2026-08-13T23:30:40Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the engines in-tree before changing the predicate.", "how_this_build_will_embody_it": "Read the three engines + the composite before editing afterPitchHeal." },
  { "id": "A22", "read_at": "2026-08-13T23:30:45Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this fix's reads; minimum set present." },
  { "id": "A38", "read_at": "2026-08-13T23:30:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
