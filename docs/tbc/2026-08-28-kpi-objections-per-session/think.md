---
started_at: 2026-08-28T06:45:00+08:00
---

# THINK — build "Objections per session" KPI (Task 3, part 2)

## Why (the founder's directive + the picker)
The KPI Analytics page lists four Layer-1/2/4 metrics with NO computation behind them — they render "building…"
forever, which misleads (a 500-session rep still sees "building"). I brought the founder a feasibility-grounded
picker; the founder chose **Objections per session** (buildable now, a leading behavioural indicator reps act on).

## Understanding (the data flow — traced end-to-end, §0 gate) + the mid-build correction (§3.3)
The `/kpi` page's LAYERS tiles are fed by `/api/coach/kpi/me`, which reads `after_pitch_summaries.payload` per
session. My FIRST read was that the payload's `moments` (each a `SalesMoment` with `kind: "objection"`) could be
counted for "objections per session". Verifying against LIVE data refuted it: the moments are a curated 3-5
HERO highlight reel ("≤1 breakdown"), so `kind="objection"` moments UNDERCOUNT real objections (every agent
came out ~0.3/session, and "resolved" wasn't derivable — a breakdown is its OWN moment kind, so objection
moments were never breakdowns → a false 100%). I ALSO checked `coaching_cues` (no persisted kind column — the
"objection" class lives only in the LLM prompt) and the `objection` SCORE (a 0-100 handling grade, not a count).
**Conclusion: no true objection COUNT is stored anywhere.** I corrected the founder (§3.3 — my earlier
feasibility read was partly wrong) and surfaced the fork; the founder chose **build the real tally**.

## The build (§1.5 organic — extend the EXISTING after-pitch LLM pass, no new call)
- `salesMomentsPrompt.ts` — the moments pass already reads the whole transcript; add a whole-call `objections:
  {raised, resolved}` tally to its instruction + output schema (distinct from the 3-5 hero moments; resolved ≤ raised).
- `salesMoments.ts` — `SalesMoments` gains `objections: ObjectionTally | null`; `parseObjectionTally` clamps to
  non-negative ints, resolved ≤ raised, and returns null when the model omitted it (honest exclusion, not 0/0).
- `summaryTypes.ts` — the client-safe `ObjectionTally` shape (one shared definition, the client-safe shape module).
  `afterPitch.ts` threads `momentsRes.objections` into the stored `AfterPitchSummary` payload.
- `compute.ts` — `objectionInputFromPayload` reads `payload.objections` and returns **null** for a summary with no
  tally (pre-existing sessions) so the KPI EXCLUDES it (building), never a fabricated 0. `objectionsPerSession`
  (avg raised) + `objectionResolutionRate` (resolved ÷ raised %; gated when 0 raised → no false 100%).
- `me/route.ts` — build `objectionRows` from the same `apRows` (no new read), filtering the nulls.
- `kpi/page.tsx` — wire "Objections per session" (fmt num) + a sibling "Objections resolved" (fmt pct) tile.

Because the tally is new, existing summaries lack it and the metric GATES ("building") until enough tallied
sessions accrue — which is the correct §3.4 behavior (no instant results), not a defect. History fills as
after-pitch pages regenerate; a forced LLM backfill is a separate founder cost decision, not run here.

## Scope discipline (§1.5 holistic)
- Only the `/me` self-view LAYERS need it — the team roster (TeamAgent) shows conversion/reliance/quota and the
  founder didn't ask for a team column; not touched.
- The other 3 unbuilt metrics (Sales cycle, Follow-up rate, Recommendation uptake) are NOT built here — they're
  blocked on prospect-identity data or are a separate pick (residual R1).

## Gate (A30) + honesty (§3.4)
Unit tests lock: gating below MIN_SESSIONS; avg raised; resolution = resolved ÷ raised; zero-objections → gated
(NOT a false 100%); the payload parse reads `payload.objections` and returns NULL (session EXCLUDED) for a
no-tally / old-moments / malformed payload — never a fabricated 0; parseMoments clamps resolved ≤ raised and
nulls an omitted tally. The zero-objections gate + the null-exclusion are the honesty guards — the metric never
fabricates a count or a rate it can't support.

## Session-read manifest (A22 — read_at ≥ started_at 06:45:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T06:46:00+08:00",
    "why_it_governs": "Understand the data flow before building; don't invent a metric the data can't support.",
    "how_this_build_will_embody_it": "Traced payload.moments→SalesMoment.kind end-to-end; the count is a pure derivation of stored data." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T06:46:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-28T06:46:10+08:00",
    "why_it_governs": "Organic + Holistic — reuse the layer3 pattern + the already-fetched apRows; don't touch the team roster.",
    "how_this_build_will_embody_it": "Mirrors layer3Dimension/parser; no new DB read; scope limited to the /me self-view." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-28T06:46:15+08:00",
    "why_it_governs": "Layer 2 — the tile must show a REAL number the rep can act on, end-to-end.",
    "how_this_build_will_embody_it": "The tile renders the avg objections + resolution rate from real moments; verified against live data." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-28T06:46:16+08:00",
    "why_it_governs": "THINK-first then search — form the objection-source hypothesis, then verify it against live data before building.",
    "how_this_build_will_embody_it": "Hypothesised moments-count, probed live, refuted it, and found the real gap before writing the metric." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-207", "read_at": "2026-08-28T06:46:18+08:00",
    "why_it_governs": "The founder specified the metric ('and how many you resolve') — both halves are the intended result, not optional polish.",
    "how_this_build_will_embody_it": "Builds BOTH the count and the resolution rate, not just the count." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-354", "read_at": "2026-08-28T06:46:19+08:00",
    "why_it_governs": "Guide-don't-overtake — when my feasibility read proved wrong mid-build, the fork was the founder's to decide, not mine to pick.",
    "how_this_build_will_embody_it": "Corrected the founder on the undercount, surfaced the real-tally vs relabel fork as a picker, built the chosen path." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-28T06:46:20+08:00",
    "why_it_governs": "Honesty — a resolution rate over zero objections must not fabricate 100%.",
    "how_this_build_will_embody_it": "objectionResolutionRate gates on ≥1 objection raised → 'building', never a false 100%." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-382", "read_at": "2026-08-28T06:46:25+08:00",
    "why_it_governs": "Measurement rules — anchor to a defensible signal, label the proxy honestly.",
    "how_this_build_will_embody_it": "'Resolved' = met-without-breakdown, labelled as the proxy it is, not over-claimed as 'customer overcome'." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T06:46:30+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood the flow, surfaced the pick, reused the pattern, gated honesty, verified live." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T06:46:35+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T06:46:40+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the commit trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T06:46:45+08:00",
    "why_it_governs": "Gate the lesson — the honesty guard (zero → gated) must be tested, both branches.",
    "how_this_build_will_embody_it": "Tests exercise raised>0 and raised=0; and the parser's kind/isBreakdown branches." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T06:46:50+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + EXIT code, and the live-probe numbers." }
]
```
