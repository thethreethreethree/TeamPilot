---
started_at: 2026-08-29T10:32:00+08:00
---

# THINK — lift outcome-capture adoption so Layer-1 KPIs fill

## Why (the record — a correction, verified against live data)
Founder: Layer-1 KPIs (conversion/close/revenue) have read "building" for a month. My first read said "no capture
path exists" — WRONG, corrected from the code + live data: the outcome control DOES exist (`POST /[id]/outcome` →
`setSessionOutcome` writes the column + an event; surfaced on After-Pitch in Standard and the session page in
Expert) and WORKS. Live data: every 2-week bucket has SOME outcomes (4/59, 12/161, 7/25…) — capture fires, but only
~7-30% of sessions get one. The control sits BELOW the fold (under all the scores/narrative), next to "Start Next
Door", so reps scroll past it and move on. With ~10% capture across 10 reps, almost no rep reaches the ≥5
outcome-marked sessions the KPI's Understanding Gate needs → perpetual "building". Root cause = ADOPTION, not a bug.

## Understanding (§1.5.1 layer-3 continuity, §3.5 honesty)
The founder chose (picker): intercept "Start Next Door" with a one-tap outcome prompt when none is logged — the
exact moment the rep would leave it blank. It MUST be skippable: a forced/required field makes a rushed rep tap
whatever clears the screen, and §3.5 forbids nudging toward a fast/flattering answer (a false outcome is worse than
a null one). So: prompt once, answer-or-skip, then proceed either way.

## The build — compose on the existing chokepoint (reuse, don't fork)
- `after-pitch/page.tsx` — split `startNextDoor` into an interceptor (if `outcome == null` && prompt not open →
  open the prompt, don't leave) and `proceedToNextDoor` (the unchanged create+navigate). A skippable prompt card
  renders the SAME `OUTCOME_ORDER` buttons routed through the SAME `recordOutcome` chokepoint (no new write path);
  an outcome tap records then proceeds, "Skip for now" proceeds without one.

## Verification honesty (A38)
This is a client-page UI flow with no jsdom render harness (consistent with the other Sales-Coach pages). The write
path (`/outcome` → column) is already route-tested; the intercept flow is FOUNDER-VISUAL-VERIFY: tap Start Next Door
with no outcome → prompt appears → tap an outcome → records + proceeds; tap Skip → proceeds. Typecheck clean.

## Session-read manifest (A22 — read_at ≥ started_at 10:32:00; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-08-29T10:32:02+08:00",
    "why_it_governs": "Understand from the record — this build corrects a wrong prior read using the code + live data.",
    "how_this_build_will_embody_it": "The 'no capture path' claim was corrected: the control exists + fires; the gap is adoption, shown by the per-week capture rate." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-29T10:32:06+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md + ThinkerThinker.md re-opened this session; cited below." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-29T10:32:10+08:00",
    "why_it_governs": "Layer-3 continuity — the fix must leave the rep flowing (answer or skip, then Start Next Door), not stalled by a forced field.",
    "how_this_build_will_embody_it": "The prompt is skippable and proceeds either way; it intercepts once at the move-on moment." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-08-29T10:32:14+08:00",
    "why_it_governs": "THINK-first — verified the capture ALREADY exists before building, avoiding a duplicate control.",
    "how_this_build_will_embody_it": "Reused the existing recordOutcome chokepoint; no new write path or endpoint." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-383", "read_at": "2026-08-29T10:32:18+08:00",
    "why_it_governs": "Measure consequence honestly — a forced outcome yields flattering/garbage taps; a loss is the valuable data.",
    "how_this_build_will_embody_it": "The prompt is skippable; the copy names a loss as the most valuable, never nudging toward 'sold'." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-08-29T10:32:22+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: corrected the diagnosis from the record, reused the chokepoint, kept the rep flowing, surfaced the fix as a picker." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-08-29T10:32:26+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-600", "read_at": "2026-08-29T10:32:30+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every cited § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-08-29T10:32:34+08:00",
    "why_it_governs": "Gate the lesson where a gate can bite — the write path is route-tested; the UI intercept is honestly labelled founder-visual-verify (no render harness), not asserted clean.",
    "how_this_build_will_embody_it": "The reused write chokepoint keeps its existing test; the flow's un-tested half is named, not hidden." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-08-29T10:32:38+08:00",
    "why_it_governs": "'Verified' names the command + the un-run part.",
    "how_this_build_will_embody_it": "check.md pastes the gate; the intercept flow is labelled UNTESTED (founder-visual-verify), never claimed green." }
]
```
