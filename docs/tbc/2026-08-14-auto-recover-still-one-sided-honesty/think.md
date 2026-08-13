---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T02:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 1
---

# THINK — honest terminal for the still-one-sided auto-recover outcome

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (record-check §1.2 — a §1.5.1 layer-3 workflow-continuity trace of my own shipped feature)
Tracing every /auto-recover terminal outcome through the After-Pitch page (§1.5.1 layer 3 — does each branch
leave the rep flowing?), the page collapses ALL non-recovered statuses into `setAutoRecoverResolved(true)` →
the manual re-transcribe card (page.tsx:282). For **still-one-sided** — the API's signal that the saved audio
genuinely holds ONE voice — re-transcribing reproduces the same one-sided result, so the card is a FALSE-PROMISE
LOOP: the rep taps, it re-transcribes to one voice again, and they're back where they started. The API returns
the distinct `still-one-sided` status precisely so the UI can be honest (§3.4), and the page discarded it.

## 3. The fix
Track the auto-recover terminal status (`autoRecoverOutcome`). For `still-one-sided`, render an honest terminal
message ("Only one side of this call was recorded… no second side to recover") instead of the re-transcribe
card. The recoverable outcomes are unaffected: `could-not-decide` (2 voices, auto-assign failed → the manual TAP
resolves it) and `failed` (transient → retry) still show the card, which genuinely helps there.

## 4. Interconnections traced (§1.5.1)
- `autoRecoverOutcome` is reset on `[id]` change (alongside `autoRecoverResolved`), so a session switch re-arms.
- Only `still-one-sided` gets the terminal; every other non-recovered status keeps the existing manual-card
  behavior, which is appropriate for those (re-transcribe/tap can help).
- The `bg-surface-2` token I first reached for doesn't exist (0 uses) → would render no background; corrected to
  the valid `bg-surface/60`.

## 5. Hypothesis (§1.5.2)
- **H1 — is still-one-sided the ONLY non-recovered outcome where re-transcribe can't help?** Yes: `could-not-decide`
  = 2 voices present but auto-assign unsure → the manual tap resolves it; `failed`/`already-attempted` = transient
  or a prior attempt → a manual /retranscribe (no marker) can still help. Only `single-cluster` (one voice in the
  audio) is genuinely unrecoverable by re-transcribe. CONFIRMED against autoSpeakerAssign's reasons.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T02:30:05Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the gap from the record before fixing — traced the actual page outcome handling.", "how_this_build_will_embody_it": "Read the autoRecover callback + BlankReadRecovery before changing them." },
  { "id": "§0.1", "read_at": "2026-08-14T02:30:08Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1)." },
  { "id": "§1.2", "read_at": "2026-08-14T02:30:11Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Record-check: the false-promise loop was traced in the page code, not assumed.", "how_this_build_will_embody_it": "Confirmed the else-branch collapses still-one-sided into the card path." },
  { "id": "§1.5.1", "read_at": "2026-08-14T02:30:14Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-3 workflow continuity — a terminal must leave the rep flowing, not looping.", "how_this_build_will_embody_it": "Traced every auto-recover outcome's UI state; fixed the one dead-end (still-one-sided)." },
  { "id": "§1.5.2", "read_at": "2026-08-14T02:30:16Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive THINK-then-verify — I hunted for the failing branch, then confirmed which outcomes are unrecoverable.", "how_this_build_will_embody_it": "H1 stated + confirmed against the autoAssign reasons." },
  { "id": "§3.4", "read_at": "2026-08-14T02:30:19Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Honesty — never a false promise; say what actually happened.", "how_this_build_will_embody_it": "still-one-sided gets an honest terminal, not a re-transcribe card that can't help." },
  { "id": "§6", "read_at": "2026-08-14T02:30:22Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace continuity + the reset semantics.", "how_this_build_will_embody_it": "Outcome reset on id-change; only still-one-sided changes behavior." },
  { "id": "A22", "read_at": "2026-08-14T02:30:25Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A19", "read_at": "2026-08-14T02:30:28Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the in-tree component before changing it.", "how_this_build_will_embody_it": "Read the whole BlankReadRecovery component + the autoRecover callback first." },
  { "id": "A26", "read_at": "2026-08-14T02:30:31Z", "source_file": "ThinkerThinker.md", "line_range": "640-660", "why_it_governs": "Scope — change ONLY the still-one-sided branch, leave the recoverable outcomes intact.", "how_this_build_will_embody_it": "The terminal gates on `autoRecoverOutcome === 'still-one-sided'` alone." },
  { "id": "A30", "read_at": "2026-08-14T02:30:33Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the load-bearing property with a test.", "how_this_build_will_embody_it": "The recoverable-vs-unrecoverable distinction (single-cluster vs ambiguous vs decided) is locked by autoSpeakerAssign.test.ts; the UI branch rests on it." },
  { "id": "A38", "read_at": "2026-08-14T02:30:34Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = command + output.", "how_this_build_will_embody_it": "closure.md pastes the full-gate output + exit code." }
]
```
