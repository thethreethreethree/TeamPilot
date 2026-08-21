---
started_at: 2026-08-22T01:20:00+08:00
---

# THINK — Meeting Dissect improvement-trend aggregate (Phase-6, the "did meetings improve?" signal)

The §3.6 make-learning-visible piece: aggregate the team's `meeting.dissect_generated` events into a trend.
Because meeting cues run day-1 (controlExempt) there is NO control-month baseline — so improvement can only be a
TREND over the team's OWN history, never a before/after (the ground-up audit finding). This compares the RECENT half of
meetings vs the EARLIER half on the two clearest QUALITY ratios the dissect measures: owned-action ratio
(owner-less actions are the #1 meeting failure) and focused ratio. (The ground-up audit flagged the no-baseline
constraint.)

§3.4/§3.6 honesty: below MIN_FOR_TREND meetings the direction is "insufficient" — we do NOT manufacture an
improvement curve from two data points. §3.5: it aggregates CONSEQUENCE (what meetings produced), never the
cues. Pure + defensive (a payload shape drift degrades to zero-extracted, never throws). Exposed via a
company-pinned route (INV15) so a team can see it.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Understanding precedes solving — the trend measures the team's own history because no baseline exists, understood from the audit.",
    "how_this_build_will_embody_it": "Recent-vs-earlier within the team's own dissects, not a fabricated before/after." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session (fresh 01:22 timestamps) before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Layer-2 — a trend must be reachable to matter, not just a pure lib.",
    "how_this_build_will_embody_it": "Exposed the aggregate via a company-scoped route so a team can actually see the trend." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Think about the honesty failure (a faked curve), not just the happy aggregate.",
    "how_this_build_will_embody_it": "'insufficient' below the minimum + null ratios when nothing recorded, both tested." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-415", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Honesty is the moat — never present a trend the data can't support.",
    "how_this_build_will_embody_it": "Below MIN_FOR_TREND → 'insufficient'; malformed payloads → zero-extracted, never a throw or a guessed number." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "364-415", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Anchor to CONSEQUENCE, never agreement — measure what meetings produced, not cue adoption.",
    "how_this_build_will_embody_it": "The trend reads owned-action + focused ratios (meeting outputs); it never sees or scores the cues." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "364-415", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Make learning visible — a value curve nobody can see is commercially a flat line.",
    "how_this_build_will_embody_it": "Surfaces a concrete recent-vs-earlier direction the team can see, not a hidden internal score." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood the no-baseline constraint, traced ripple (reused events, pure aggregate), stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session (01:22) before this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Encode the lesson in a gate — the 'insufficient' + null-ratio honesty is pinned by tests.",
    "how_this_build_will_embody_it": "6 aggregate tests lock the insufficient/improving/declining/flat/defensive behavior." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3598 tests, exit 0), pasted in check.md." }
]
```
