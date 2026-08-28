---
started_at: 2026-08-28T10:30:00+08:00
---

# THINK — Follow-up rate + Sales cycle from client_label (Task 3, part 6)

## Why + the correction (§0, §3.3)
The founder picked "build prospect-identity capture" to unlock the 2 blocked tiles (Sales cycle, Follow-up rate),
believing new capture was required. Before building (§0), I probed the existing data: `coaching_sessions.client_label`
is **96% populated and REUSED across sessions** (reps re-contact the same labeled prospect — 45 of 136 distinct
labels recur). So prospect identity already exists — no schema, no new capture, no adoption risk. I corrected the
founder (§3.3); the founder chose: derive from client_label now.

## Understanding (the two metrics from existing data)
Prospect identity = the NORMALIZED client_label (`prospectKeyOf`: trim + lowercase + collapse whitespace). An
honest PROXY, not an exact CRM id — free-text can mismatch ("Mr. Smith" ≠ "John Smith") or collide (two
"John Smith"s). The surface frames it as label-based ("by name", "by prospect"), never a precise count (§3.4).
- **Follow-up rate** = distinct prospects re-contacted (>1 session) ÷ total distinct prospects. Gate: ≥ MIN_SESSIONS
  distinct labeled prospects.
- **Sales cycle length** = avg (first-contact → first sold session) in days over SOLD prospects (0 for a same-session
  close). Gate: ≥ MIN_SESSIONS sold prospects.

## The build (§1.5 organic — reuse the sessions already fetched)
- `compute.ts` — `prospectKeyOf` + `followUpRate` + `salesCycleLengthDays` (pure; the me route already selects
  `client_label, started_at, outcome`, so NO new read).
- `me/route.ts` — build `prospectRows` from `data`; set `metrics.followUpRate` + `metrics.salesCycleLength`.
- `kpi/page.tsx` — the two tiles drop `blocked` and wire their apiKeys; a `days` format is added for the cycle.

## Verified live (§1.5.1 layer 2)
Follow-up rate is LIVE: Johns 25%, Moses 29.7%, others 28-36%. Sales cycle: Moses 0.1d (his session-sells mostly
close same-visit), and honestly GATES for reps with <5 sold prospects — the §3.4 Understanding Gate, not a defect.

## Session-read manifest (A22 — read_at ≥ started_at 10:30:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T10:31:00+08:00",
    "why_it_governs": "Understand what data exists before building capture — the same discipline that caught the objections undercount.",
    "how_this_build_will_embody_it": "Probed client_label (96% populated, reused) BEFORE assuming a new-capture build; found it unnecessary." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T10:31:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-28T10:31:10+08:00",
    "why_it_governs": "Organic + Holistic — reuse the client_label the me route already fetches; the cheapest correct path.",
    "how_this_build_will_embody_it": "Pure functions over the existing session read; no schema, no new query, no capture UX." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-28T10:31:15+08:00",
    "why_it_governs": "Layer 2 — the tiles must show a REAL, correct number end-to-end.",
    "how_this_build_will_embody_it": "Verified live: follow-up 25-36%, sales-cycle 0.1d for Moses; gates honestly elsewhere." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-28T10:31:18+08:00",
    "why_it_governs": "THINK-first then search — hypothesise client_label as the prospect key, verify its reuse live before building.",
    "how_this_build_will_embody_it": "Probed population + recurrence first; confirmed derivable, then built." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-354", "read_at": "2026-08-28T10:31:20+08:00",
    "why_it_governs": "Guide-don't-overtake — the premise of the founder's pick (new capture needed) was wrong; correcting it is theirs to decide.",
    "how_this_build_will_embody_it": "Surfaced the cheaper client_label path as a picker; built the option the founder then chose." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-28T10:31:25+08:00",
    "why_it_governs": "Honesty — a free-text label is a proxy; gate where thin, frame it as label-based, never a precise count.",
    "how_this_build_will_embody_it": "Notes say 'by name/prospect'; both metrics gate to 'building' below MIN_SESSIONS; sales-cycle honestly thin for most reps." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-382", "read_at": "2026-08-28T10:31:28+08:00",
    "why_it_governs": "Measure a real behaviour/consequence, not a vanity number.",
    "how_this_build_will_embody_it": "Follow-up rate = actual re-contact behaviour; sales cycle = real elapsed time to close." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T10:31:30+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: probed the data, corrected the premise, reused existing reads, gated honesty, verified live." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T10:31:35+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T10:31:40+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T10:31:45+08:00",
    "why_it_governs": "Gate the lesson — the gating (thin data → building) and the normalizer must be tested.",
    "how_this_build_will_embody_it": "Tests cover normalization, re-contact counting, cycle averaging, and both gates." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T10:31:50+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + exit code, and the live-probe numbers." }
]
```
