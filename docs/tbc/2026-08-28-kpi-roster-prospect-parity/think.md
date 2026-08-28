---
started_at: 2026-08-28T11:05:00+08:00
---

# THINK — Follow-up + Sales cycle on the manager roster (Task 3, part 7)

## Why (the founder's pick)
The manager roster showed Objections + Uptake per rep but not the two just-built prospect metrics (Follow-up rate,
Sales cycle). The founder chose roster parity so managers see the full per-rep picture.

## The build (§1.5 — reuse the session read; mirror the objections/uptake roster addition)
The team route already reads the team's sessions; add `client_label` to that select, build per-agent
`ProspectSessionInput[]` in the same byAgent loop, and run the SAME `followUpRate` / `salesCycleLengthDays` as /me
(same gates → a rep's roster number matches their own). The roster row + CSV gain Follow-up % and Cycle (days)
columns. No new query.

## Privacy (A18) + honesty (§3.4)
The two new fields are aggregate MetricResults (value/sampleSize/gated/sourceSessionIds), never raw per-session
data — the A18 allow-list is updated consciously and its raw-leak assertions still pass. Both gate "building" where
thin (same as /me), so a rep with too few prospects/closes shows no fabricated number.

## Session-read manifest (A22 — read_at ≥ started_at 11:05:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T11:06:00+08:00",
    "why_it_governs": "Understand the roster already reads the sessions before adding a query.",
    "how_this_build_will_embody_it": "Added client_label to the existing select; no new round-trip." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T11:06:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-28T11:06:10+08:00",
    "why_it_governs": "Organic + Holistic — reuse the session read + the same compute functions as /me.",
    "how_this_build_will_embody_it": "One column added to the select; identical functions; the A18 ripple traced." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-28T11:06:15+08:00",
    "why_it_governs": "Layer 2 — the roster number must match the rep's own (cross-view consistency).",
    "how_this_build_will_embody_it": "Same followUpRate/salesCycleLengthDays + gates as /me." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-28T11:06:18+08:00",
    "why_it_governs": "THINK-first — re-check the roster privacy contract before adding fields.",
    "how_this_build_will_embody_it": "Confirmed the new fields are aggregates; the A18 test guards it." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-28T11:06:20+08:00",
    "why_it_governs": "Honesty — gate 'building' where thin; a free-text-label proxy, not a precise count.",
    "how_this_build_will_embody_it": "Both metrics gate below MIN_SESSIONS on the roster, same as /me." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T11:06:25+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: reused the read, matched /me, honored A18, kept scope." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "57-57", "read_at": "2026-08-28T11:06:30+08:00",
    "why_it_governs": "The rollup exposes derived aggregates, NEVER raw per-session data.",
    "how_this_build_will_embody_it": "The 2 new fields are aggregate MetricResults; the A18 allow-list + raw-leak assertions still pass." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T11:06:35+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T11:06:40+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T11:06:45+08:00",
    "why_it_governs": "Gate the lesson — the privacy allow-list stays exact so a future leak fails a test.",
    "how_this_build_will_embody_it": "Updated the A18 allow-list consciously (aggregates only); raw-leak assertions still guard it." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T11:06:50+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + exit code." }
]
```
