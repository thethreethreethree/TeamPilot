---
started_at: 2026-08-22T01:21:00+08:00
---

# THINK — Meeting trend tile (§3.6 make-learning-visible, on-surface)

The trend aggregate + route exist but nothing shows them — a value curve nobody can see is commercially a flat
line (§3.6). `MeetingTrendTile` fetches `GET /trend` and renders the team's direction (improving / holding /
slipping / not-enough-data) + the two quality ratios (actions owned, stayed focused) + decisions/meeting. Placed
at the top of the meeting-coach SETUP view so the facilitator sees their team's trend right where they start a
meeting. Honest: "insufficient" is shown plainly (no faked curve); the tile renders NOTHING on a load failure (a
dashboard tile must never break the page). Theme tokens; tabular-nums for the figures. Client-only.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Understanding precedes solving — the tile renders exactly the aggregate's honest direction, adding no new claim.",
    "how_this_build_will_embody_it": "Maps the trend struct 1:1; 'insufficient' is surfaced, not hidden behind a fake number." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session (01:22) before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Layer-3/4 — the trend must be VISIBLE where the facilitator works, not just an endpoint.",
    "how_this_build_will_embody_it": "Placed on the setup view; honest loading/insufficient/hidden states, never a broken tile." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Think about the failure surface (a tile that breaks the page).",
    "how_this_build_will_embody_it": "Renders null on any load failure so it can never break the meeting-coach page." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "364-415", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Make learning visible — surface the evidence the system is helping, or the value curve reads as flat.",
    "how_this_build_will_embody_it": "A concrete on-surface tile showing the team's meeting-improvement direction + ratios." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood the trend shape, traced ripple (client-only, one panel edit), stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session (01:22) before this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "Encode the lesson — theme legibility is caught by theme:audit.",
    "how_this_build_will_embody_it": "Semantic theme tokens (theme:audit green), not raw zinc." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T01:22:34+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3598 tests, exit 0, incl. theme:audit), pasted in check.md." }
]
```
