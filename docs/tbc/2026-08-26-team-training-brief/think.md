---
started_at: 2026-08-26T10:15:00+08:00
---

# THINK — Team Training Brief engine (founder "team feedback engine first" slice)

## The ask + the chosen slice
Founder (Moses, via picker): build the training system incrementally, TEAM FEEDBACK ENGINE FIRST. Founder's words:
"feedback for not just the individual rep but for the team as a whole. Based on the performance from the previous
day/week. The AI will generate a training/suggestions for training to the manager that can be implemented immediately
during the team meeting the following day." This slice = the DATA + generation layer everything later displays: a
manager-facing team training brief from the last period's pooled coaching signal.

## Understanding (mirror the existing engine pattern, real data)
Mirrored the debrief/salesReview engine shape: a prompt builder + an engine that reads data, calls the coach LLM
(`debriefCoachV5`, controlExempt like salesReview so it runs day-1), parses strict JSON, honest-empty below a signal
threshold. The team signal is REAL: pooled `coach.dissect_generated` payloads across the company's reps for the last
7 days, aggregated via the existing `aggregateDissectContent`, then FREQUENCY-RANKED (the shared pattern, not one rep's).

## The build (§1.5.1 layers 2 + 4)
- `teamTrainingBriefPrompt.ts` — system+user builders; strict-JSON output {themes[], drill{title,steps}, repFocus[]}.
- `teamTrainingBrief.ts` — engine: pool + frequency-rank the team's recent growth/strategy/strength signal, add door
  totals (best-effort context), refuse below MIN_DISSECTS=3 (§3.4 — no brief fabricated from nothing), LLM, parse.
- Route `team-training-brief` (POST, MANAGER-gated, rate-limited, maxDuration 300) → the brief.
- Surface: a "Team training brief" card on the Coach Assessment page — a Build button + themes / a runnable drill /
  one focus per rep. Honest states for insufficient signal.

## §3.4 / §A18 honesty
- §3.4: below-threshold → no LLM call, an honest "not enough sessions yet" state; `parseTeamBrief` returns null on
  malformed JSON or a brief with no theme AND no drill (never render an empty shell as if it taught something).
- §A18: the brief teaches the TEAM's pattern; the per-rep line is a one-line coaching FOCUS (a direction), NOT a
  grade or ranking, and `parseTeamBrief` DROPS any repFocus naming a rep the engine didn't include (no hallucinated names).

## Ripple (holistic — §6 item 5)
- New engine/route/prompt + a card; reuses aggregateDissectContent + the coach LLM caller. No schema change.
- The page card is type-only-importing the engine's result type (server-only module erased at build) — verified typecheck.
- Slice boundary: this is the data+manager-surface layer; the full Training tab (rep portal, materials, practice) is
  the founder-chosen NEXT slice — not built here.

## A30 gate
`parseTeamBrief` is unit-tested: drops a hallucinated rep, returns null on no-signal/malformed, tolerates a json fence,
caps themes/steps. The honesty-relevant behavior fails a test without cooperation.

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 10:15:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-26T10:33:10+08:00",
    "why_it_governs": "Understand the engine pattern + the real data before generating.",
    "how_this_build_will_embody_it": "Mirrored the debrief/salesReview engine; the brief is built from the team's REAL pooled dissect signal, frequency-ranked." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-26T10:33:12+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read fresh this build." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "88-102", "read_at": "2026-08-26T10:33:14+08:00",
    "why_it_governs": "Layers 2 + 4 — the brief must actually generate useful team training AND surface clearly to the manager.",
    "how_this_build_will_embody_it": "Concrete themes + a runnable drill + per-rep focus, on a clear manager card with honest states." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-149", "read_at": "2026-08-26T10:33:16+08:00",
    "why_it_governs": "THINK the surrounding constraints (leader-visibility, honesty) not just the literal ask.",
    "how_this_build_will_embody_it": "Framed per-rep as a focus not a rank (A18), and refused fabrication below threshold (§3.4)." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-367", "read_at": "2026-08-26T10:33:18+08:00",
    "why_it_governs": "Honesty is the moat — no fabricated brief.",
    "how_this_build_will_embody_it": "MIN_DISSECTS threshold (no LLM below it); parseTeamBrief null on malformed/no-signal; drops hallucinated reps." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-436", "read_at": "2026-08-26T10:33:20+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: mirrored a verified pattern, real data, honest states, gated the parse." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-433", "read_at": "2026-08-26T10:33:05+08:00",
    "why_it_governs": "Surfacing team behavior to a leader — the label is the defense; per-rep must not become a ranking.",
    "how_this_build_will_embody_it": "Per-rep is a one-line FOCUS (a direction), never a grade/rank; the brief teaches the team pattern; hallucinated reps dropped." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-457", "read_at": "2026-08-26T10:33:22+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-596", "read_at": "2026-08-26T10:33:24+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-772", "read_at": "2026-08-26T10:33:26+08:00",
    "why_it_governs": "Gate the honesty behavior.",
    "how_this_build_will_embody_it": "parseTeamBrief unit tests pin drop-hallucinated-rep + null-on-no-signal + fence tolerance." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1003", "read_at": "2026-08-26T10:33:28+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
