---
started_at: 2026-08-28T07:20:00+08:00
---

# THINK — build "Recommendation uptake" KPI (Task 3, part 3)

## Why (the founder's pick)
After shipping the objections metric, I surfaced the next-step picker; the founder chose **Recommendation uptake**
— the last unbuilt KPI tile that's the product's differentiator (does the coaching actually WORK, §4/§3.6).

## Understanding + the direction catch (§0 — this nearly shipped inverted)
The tile means "did last session's advice show up next session?". The advice a session gives = its Next-Door
Focus, which `deriveFocus` takes from a FLAGGED score dimension when one exists. So I can measure uptake
DETERMINISTICALLY (no LLM, §3.5 consequence-not-agreement): for each session N with a flagged focus dimension D,
did session N+1 move D toward the healthy middle? Live probe confirmed it's viable — 60/152 payloads flag a focus
(keys: talk_ratio ×52, question_rate ×8), and Moses (22 pairs) + Johns (5 pairs) clear the gate.

**The catch (§0, verified in salesScore.ts):** the two flaggable dimensions score in OPPOSITE directions.
`talk_ratio.score` = the rep's talk share (flagged when ≥75 → improving means the score goes DOWN). `question_rate.score`
= questions asked (flagged when ≤15 → improving means the score goes UP). A naive `after > before` would have
counted a rep who talked EVEN MORE as "took the advice" — the metric inverted. So uptake must be DIRECTION-AWARE
per dimension, and any flagged dimension without a known direction is skipped (not guessed).

## The build (§1.5 organic — deterministic, reuse the stored scores + the same payloads)
- `compute.ts` — `FOCUS_IMPROVEMENT_DIR` (talk_ratio→lower, question_rate→higher, kept in sync with salesScore.ts);
  `recommendationInputFromPayload` (focusKey = first flagged dimension WITH a known direction, + the score map);
  `recommendationUptake` (dedups append-only multi-view rows, orders by start time, counts a taken-up pair iff N+1
  moved the focus dim the improving way; gate ≥ MIN_SESSIONS evaluable pairs).
- `me/route.ts` — build `recommendationRows` from the same `apRows` + a session→started_at map from `data`
  (no new read); set `metrics.recommendationUptake`.
- `kpi/page.tsx` — wire the "Recommendation uptake" tile (fmt pct).

## Scope / honesty
- Deterministic, no LLM → no cost, and it measures CONSEQUENCE (the dimension actually improved), never
  "the rep agreed" (§3.5 — measuring agreement is grading your own homework).
- Gates honestly (only Moses + Johns clear today) — the §3.4 Understanding Gate, not a defect; it builds as
  flagged-then-rescored pairs accrue.
- Append-only dedup is a structural guard: a re-viewed session must never pair with itself (a false 0-delta).

## Session-read manifest (A22 — read_at ≥ started_at 07:20:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-28T07:21:00+08:00",
    "why_it_governs": "Understand the score DIRECTION before computing 'improved' — a wrong sign inverts the whole metric.",
    "how_this_build_will_embody_it": "Read salesScore.ts; encoded per-dimension improvement direction; a naive comparison was caught and rejected." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-28T07:21:05+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-opened via Read this session." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-28T07:21:10+08:00",
    "why_it_governs": "Organic + Holistic — reuse the stored scores + the already-fetched payloads; keep the direction map in sync with the source.",
    "how_this_build_will_embody_it": "No new read/LLM; a comment ties FOCUS_IMPROVEMENT_DIR to salesScore.ts; scope limited to /me." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-08-28T07:21:15+08:00",
    "why_it_governs": "Layer 2 — the tile must show a number that's actually CORRECT end-to-end, not just present.",
    "how_this_build_will_embody_it": "Verified the direction-aware count against live data (Moses 13/22, Johns 4/5)." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-08-28T07:21:18+08:00",
    "why_it_governs": "THINK-first then search — hypothesise the flagged-focus signal, probe live before building.",
    "how_this_build_will_embody_it": "Probed feasibility + the direction question against real payloads first." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-28T07:21:20+08:00",
    "why_it_governs": "Honesty — gate to 'building' until real evaluable pairs exist; never fabricate an uptake %.",
    "how_this_build_will_embody_it": "Gate ≥ MIN_SESSIONS evaluable pairs; a non-rescored pair is excluded, not guessed." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-382", "read_at": "2026-08-28T07:21:25+08:00",
    "why_it_governs": "Measure downstream CONSEQUENCE, not agreement — the core of an honest coaching-efficacy metric.",
    "how_this_build_will_embody_it": "Uptake = the flagged dimension actually improved next session, never 'the rep adopted the suggestion'." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "410-414", "read_at": "2026-08-28T07:21:28+08:00",
    "why_it_governs": "Make learning visible — surface whether coaching is landing over time.",
    "how_this_build_will_embody_it": "The tile shows the rep whether last session's focus improved the next — visible coaching effect." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "419-430", "read_at": "2026-08-28T07:21:30+08:00",
    "why_it_governs": "Coaching efficacy is gated by OUTCOME, not a persuasive claim.",
    "how_this_build_will_embody_it": "The metric is an outcome measure (did behaviour change), gated until the evidence exists." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-28T07:21:35+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood the direction, probed live, reused stored data, gated honesty." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-08-28T07:21:40+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-08-28T07:21:45+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the commit trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-08-28T07:21:50+08:00",
    "why_it_governs": "Gate the lesson — the direction correctness (the inversion trap) must be tested BOTH ways.",
    "how_this_build_will_embody_it": "Tests assert talk_ratio (lower=uptake) AND question_rate (higher=uptake), plus dedup + gate." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-08-28T07:21:55+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the real `npm run check` output + exit code, and the live-probe numbers." }
]
```
