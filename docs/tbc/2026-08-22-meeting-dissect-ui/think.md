---
started_at: 2026-08-22T00:26:44+08:00
---

# THINK — Meeting Dissect review UI (Phase-6 wiring, step 3: human-facing)

The last piece that makes the Dissect a feature a person uses. `MeetingReview` (client component) + a review page
fetch/generate the dissect via the route and render the meeting's CONSEQUENCES: decisions reached, action items
with their owner (an owner-less action flagged amber — the #1 meeting failure made visible), open items, an
effectiveness read, and the overall. §3.5 is honored at the surface too: it shows what the MEETING produced and
never the coach's cues, so a viewer can't read it as "did the facilitator obey the coach." Honest states: an
"analyzing" wait (transcription takes a moment), a "recording not ready" (409) retry, an error retry, and an
honest empty read for a short/exploratory meeting. Theme tokens throughout (legible in light + dark — the panel
theme lesson). No sales/server change.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Understanding precedes solving — the UI renders exactly the measurement the core produces.",
    "how_this_build_will_embody_it": "It maps decisions/actions/open-items/effectiveness 1:1 from the dissect payload, no new interpretation." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Layer-3/4 — the review must leave the facilitator informed, not at a dead end or a raw JSON blob.",
    "how_this_build_will_embody_it": "Renders a legible review with honest analyzing/pending/error/empty states and retry, not a spinner-forever or a crash." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Think about the failure surfaces, not just the happy render.",
    "how_this_build_will_embody_it": "Handles 409 (audio not ready), non-ok, and thrown fetch distinctly, each with a retry." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "364-433", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The surface must present downstream CONSEQUENCE, never agreement with the coach.",
    "how_this_build_will_embody_it": "The review shows the meeting's decisions/actions/open-items; it never shows or scores the cues." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood the payload shape, traced ripple (client-only), stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session before this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Encode the lesson — theme legibility is caught by theme:audit, the encoded form of the invisible-text lesson.",
    "how_this_build_will_embody_it": "Uses semantic theme tokens (theme:audit green), not the raw zinc that failed on the panel." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3588 tests, exit 0, incl. theme:audit), pasted in check.md." }
]
```
