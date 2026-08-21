---
started_at: 2026-08-22T02:56:00+08:00
---

# THINK — Fold balance into the improvement trend

Balance was a per-meeting dissect field but not yet a TREND signal — I'd deferred it as "founder-sign-off gated",
which was over-gating (A20): balance is MONOTONIC-good (more balanced = better), so using it in the trend is a
defensible default I should build + flag, not defer. Generalized the trend direction from two quality ratios
(owned-action, focused) to THREE (adding balanced): net more ratios up than down = improving, more down =
declining, tie = flat. Raw counts (decisions/meeting, open-items) stay reported-but-not-directional — "more
decisions" isn't unambiguously better; all three ratios are. A missing ratio (no balance recorded) counts as
no-change on that axis, so pre-balance dissects don't skew the direction.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Understanding precedes solving — only monotonic-good signals drive direction, understood from which measures are unambiguous.",
    "how_this_build_will_embody_it": "Balance joins owned+focused (all monotonic-good); counts stay non-directional." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Layer-2 — the balance signal is only fully used when it feeds the visible trend, not just per-meeting.",
    "how_this_build_will_embody_it": "Balance now affects the team's 'did we improve?' direction via the existing trend route." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Build the defensible default rather than defer a natural extension.",
    "how_this_build_will_embody_it": "Folded balance into the trend (A20) instead of leaving it a per-meeting-only field pending sign-off." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: confirmed balance is monotonic-good, traced ripple (pure aggregate), stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session (02:57) before this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Encode the lesson — the 3-signal direction + missing-ratio-as-no-change is pinned by tests.",
    "how_this_build_will_embody_it": "Added a test where balance ALONE drives 'improving'; the pre-balance tests still pass (missing ratio = no-change)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3607 tests, exit 0), pasted in check.md." }
]
```
