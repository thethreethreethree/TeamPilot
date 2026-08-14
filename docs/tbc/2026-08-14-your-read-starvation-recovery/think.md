---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T09:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — "Your read" empty on longer/large-corpus calls (starvation) + remove the length cap

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) in-tree, hashes verified. Cited amendments read in
ThinkerThinker.md this session; CLAUDE.md §§ in-context.

## 2. Why (founder 2-device test 2026-08-14, confirmed by reading the engine + the accounts)
Founder ran two devices at once. One account's 3m22s call → "Your read didn't come through" (EMPTY); the other's
1m35s call → a full read. Investigating: BOTH accounts are admin + Standard mode (no per-account limitation — the
founder asked, and there is none to remove). The difference is the COMPANY: `debriefCoachV5` (the "Your read"
engine) runs deepseek-v4, a REASONING model whose `reasoning_content` precedes the answer and counts against the
~8k output ceiling; a larger company corpus in the system prompt drives MORE reasoning, so on a longer call it
burns the whole budget and returns EMPTY. And the after-pitch screen made a length EXCUSE — "a very short exchange
may not have enough to write a full read" — a soft length CAP the founder has repeatedly said to remove (no
minimum length; every call gets a read).

## 3. The fix
- **F1 (starvation):** `generateSalesReview` now RETRIES on an empty/no-signal response — the second attempt uses
  the LEAN built-in prompt (no company corpus/product), which cuts the biggest reasoning driver so the answer
  isn't starved. The TRANSCRIPT (the actual call) is unchanged, so a real read still comes through. Both attempts
  still LOG the miss (INV22 visibility). Only the honest empty survives when BOTH starve.
- **F2 (cap):** removed the "a very short exchange may not have enough to write a full read" excuse from the
  after-pitch blank-narrative fallback; it now says the read is being rebuilt + points at the scores/focus + Rebuild.

## 4. Interconnections traced (§1.5)
- The retry is a second LLM call ONLY on an otherwise-EMPTY read — no cost on the happy path.
- The `MIN_AGENT_SEGMENTS = 1` gate is UNCHANGED (it excludes only a genuine 0-agent capture gap, never a short
  call) — the cap being removed is the after-pitch EXCUSE TEXT, not a functional length gate.
- The EmptyReadBanner (shipped earlier today) already names the empty read; the reworded fallback + the retry make
  it a transient "rebuilding" state that usually resolves, not a permanent blank.
- The dissect engine (salesDissect) has the SAME starvation shape; applying the retry there is a flagged
  follow-up (separate section, not the founder's visible "Your read").

## 5. Hypothesis (§1.5.2)
- **H1 — does a first EMPTY attempt now get retried leaner and return a real read?** Yes — salesReview.generate
  test: attempt 1 empty → the leaner retry returns the read (hasSignal true, 2 debrief calls); when BOTH starve,
  the honest empty survives and each miss is logged.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T09:30:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand from the record — read the review engine, the token budget, AND the two accounts before concluding it's not a per-account limit.", "how_this_build_will_embody_it": "Queried both accounts (same admin/Standard) + read debriefCoachV5's 700+7000 budget before choosing the retry fix." },
  { "id": "§0.1", "read_at": "2026-08-14T09:30:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified; amendments read in-session." },
  { "id": "§1.2", "read_at": "2026-08-14T09:31:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — the starvation class is on the record (reference_reasoning_model_token_starvation); the corpus is the reasoning driver near the model ceiling.", "how_this_build_will_embody_it": "Drop the corpus on retry — the known biggest reasoning driver — rather than raise a budget already at the 8k ceiling." },
  { "id": "§1.5", "read_at": "2026-08-14T09:31:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the retry must not cost on the happy path, must keep the INV22 logging, must not touch the MIN gate or the transcript.", "how_this_build_will_embody_it": "Section 4: retry only on empty, logging preserved, MIN gate + transcript unchanged." },
  { "id": "§1.5.1", "read_at": "2026-08-14T09:32:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 effectivity — the feature (a written read) simply didn't work on longer/large-corpus calls; fix the effectivity, not just the message.", "how_this_build_will_embody_it": "The retry makes the read actually generate; the cap removal fixes the misleading surface." },
  { "id": "§1.5.2", "read_at": "2026-08-14T09:32:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-verify: the per-account-limit hypothesis was CHECKED (both accounts identical) before ruling it out; the starvation confirmed by reading the budget.", "how_this_build_will_embody_it": "H1 gated by the recovery test." },
  { "id": "§3.4", "read_at": "2026-08-14T09:33:00Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Honesty / no instant excuse — a length CAP that blames 'too short' is a false cause (the real one is starvation), and a blank read swallowed is error-as-no-data (INV22).", "how_this_build_will_embody_it": "Removed the false 'too short' excuse; the retry + the loud log ensure a starved read is recovered or honestly named, never silently blank." },
  { "id": "§6", "read_at": "2026-08-14T09:33:30Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (happy-path cost, logging, MIN gate, the dissect sibling).", "how_this_build_will_embody_it": "All enumerated in Section 4." },
  { "id": "A19", "read_at": "2026-08-14T09:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read salesReview + debriefCoachV5 + the deepseek headroom + the accounts before editing." },
  { "id": "A22", "read_at": "2026-08-14T09:34:30Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendments read in ThinkerThinker.md this session." },
  { "id": "A26", "read_at": "2026-08-14T09:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "A finding is one instance of a class — the starvation class also hits the dissect engine; flagged rather than force-fixed blind.", "how_this_build_will_embody_it": "Fixed the review (the visible 'Your read'); flagged salesDissect for the same retry." },
  { "id": "A30", "read_at": "2026-08-14T09:35:30Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "salesReview.generate test locks the retry-recovery (first empty → leaner retry returns the read; both empty → honest empty + logged)." },
  { "id": "A38", "read_at": "2026-08-14T09:36:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit 0." }
]
```
