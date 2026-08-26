---
started_at: 2026-08-26T14:40:00+08:00
---

# THINK — Practice engine (slice 3, founder pick "Roleplay + focus-scoring")

## The ask + the chosen fork
Founder deferred the practice engine in slice 2 as "worth scoping separately," then (picker 2026-08-26) chose
**"Roleplay + focus-scoring"**: reps practice against the EXISTING AI roleplay; scenarios auto-seeded from their own
training focuses + the team drill; each attempt scored against those focuses. This is the last piece of John Knudtson's
original ask ("materials + exercises + AI-giving-feedback-as-reps-practice").

## Grounding (why this fork — web + our data)
- Web (2026 AI-sales-roleplay category — Hyperbound, Second Nature, Mindtickle, Quantified): the standard is a LIVE AI
  roleplay + scored feedback against a CUSTOMIZABLE scorecard (methodology adherence / specific coachable behaviors,
  not just talk-listen ratio) + scenarios AUTO-GENERATED from existing materials (Second Nature seeds from playbooks).
- Our data/infra: we ALREADY have a Roleplay surface + live-coaching engine + per-rep dissect focuses
  (growthAreas/strategies via `aggregateDissectContent`) + the brief's team drill. So "reuse Roleplay, seed from the
  rep's own focus, score against that focus" is BOTH category-standard AND the lowest new build on tested infra.

## The core design (REUSE, do not fork)
The rep opens Training → a focus → "Practice" → a live roleplay whose scenario is SEEDED from that focus → at the end,
the attempt is SCORED against the focus (did the rep actually apply the coached move?) → feedback + retry, logged.
The ENGINE is the existing roleplay; slice 3 adds (a) focus→scenario seeding, (b) a focus-anchored scorecard, (c) the
entry point + result logging. NOTHING that duplicates the roleplay conversation loop.

## Reuse map (answered by the engine survey before building — §0: understand first)
- Route `POST /api/coach/sales-session/roleplay`, phases `turn`|`review`; STATELESS (client posts full history each turn,
  nothing persisted BY DESIGN — a roleplay must not pollute real session history/metrics). LLM = `dissectCoachV5`
  (already controlExempt + corpus-grounded via `getCurrentSalesCorpus` + `extractObjectionGuidance`). Not streaming.
- Scenario seeding: the route already injects arbitrary text (`customPrompt`) into the prospect persona. Slice 3 adds a
  FIRST-CLASS `focus` field instead of overloading customPrompt — it shapes the prospect's BEHAVIOUR (create moments
  that test the skill) and switches the review to scored. customPrompt (free-text situation) stays independent.
- Scoring: roleplay's review is QUALITATIVE, NO score (page.tsx honestly disclaims it's the light practice read). So a
  scored pass is net-new — added as a focus-anchored branch (`practiceReviewSystem` + `parsePracticeReview`), NOT a
  fork of the conversation loop. The default (no-focus) review is byte-for-byte unchanged.
- Seed source: the rep's own focuses already surface on the Training tab (my-training → `aggregateDissectContent`
  growth/strategies). Slice 3 makes each a "Practice" link → `/roleplay?focus=<skill>`.
- Persistence: DELIBERATELY none this slice (mirrors roleplay's stateless design) — the scorecard shows immediately,
  is not stored. Practice history/analytics = a follow-up needing a schema; flagged in closure, not built.

## Honesty constraints (§3.4 / §A18) — settled regardless of reuse shape
- §3.4: a rep with NO dissect focus yet gets an honest "practice unlocks once you have a coached session" state, never
  a fabricated scenario. A scoring pass that returns nothing usable → honest "couldn't score this attempt," not a fake score.
- §A18: the score is a PRACTICE score on the rep's OWN attempt against their OWN focus — self-data, self-improvement,
  never surfaced as a cross-rep ranking to a leader.

## The focus-anchored scorecard (engine-independent design — safe to settle now)
The differentiator (web: "customizable scorecard measuring the specific behaviors that lead to outcomes") is that we
score against the REP'S OWN coached focus, not a generic rubric. Given `{focus, scenario, transcript}` the scoring pass
returns strict JSON:
- `applied`: boolean — did the rep actually attempt the coached move this focus names?
- `score`: 0-100 — how well, anchored to the focus (NOT a generic "good salesperson" score).
- `whatWorked`: 1-2 specific moments from the transcript where they applied it (quote-anchored).
- `whatToAdjust`: 1-2 specific, actionable next-attempt corrections (no dashes, coach-the-move voice).
- `nextRep`: one line — the single thing to try next attempt.
Honesty seams (mirror parseTeamBrief): null/honest-fail on malformed JSON or an empty transcript (nothing to score);
`applied:false` is a VALID honest outcome (they didn't get to the move) — never inflate to a fake score. This maps a
draft attempt against the focus the same way the Coach maps a draft sentence against a principle — reuse that framing.

## Slice boundary
This slice = the practice LOOP (seed → live roleplay → focus-scored feedback → retry/log). Manager-visible practice
ANALYTICS (who practiced, trend over time) is a natural follow-up, NOT built here unless it falls out for free.

## Session-read manifest (A22 — every citation carries a THIS-SESSION read_at ≥ started_at 14:40:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-08-26T15:12:10+08:00",
    "why_it_governs": "Understand the roleplay engine before reusing it — a guessed engine shape is the §0 failure.",
    "how_this_build_will_embody_it": "Surveyed the roleplay route/page first; slice 3 REUSES its turn loop + dissectCoachV5, forks nothing." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-26T15:12:12+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read this session (this manifest)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "88-137", "read_at": "2026-08-26T15:12:14+08:00",
    "why_it_governs": "Layers 2 + 4 — practice must actually score the skill AND read clearly to the rep.",
    "how_this_build_will_embody_it": "Focus-anchored scorecard (real score on the drilled skill) + a clear scorecard card + honest applied:false state." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-148", "read_at": "2026-08-26T15:12:16+08:00",
    "why_it_governs": "THINK the constraint — roleplay is stateless BY DESIGN; don't quietly add persistence.",
    "how_this_build_will_embody_it": "Kept the practice stateless (no schema); flagged history/analytics as a follow-up, not a silent add." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-367", "read_at": "2026-08-26T15:12:18+08:00",
    "why_it_governs": "Honesty is the moat — no fabricated score.",
    "how_this_build_will_embody_it": "applied:false is a valid honest outcome; parsePracticeReview null on malformed → 502; score clamped, never inflated." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-438", "read_at": "2026-08-26T15:12:22+08:00",
    "why_it_governs": "The quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood the engine, reused it, honest states, single-branch (default path untouched)." },
  { "id": "§A18", "source_file": "ThinkerThinker.md", "line_range": "431-434", "read_at": "2026-08-26T15:15:00+08:00",
    "why_it_governs": "Surfacing behaviour data — a score must not become a leader-facing ranking.",
    "how_this_build_will_embody_it": "The score is the rep's OWN practice attempt against their OWN skill (self-data, self-improvement); NOT surfaced cross-rep to a manager." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-460", "read_at": "2026-08-26T15:12:20+08:00",
    "why_it_governs": "Methodology in the working tree, consulted not cached.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session before writing." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-597", "read_at": "2026-08-26T15:12:24+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a read_at; the commit trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-772", "read_at": "2026-08-26T15:12:26+08:00",
    "why_it_governs": "Gate the lesson — a fix isn't done until a gate fails without cooperation.",
    "how_this_build_will_embody_it": "parsePracticeReview honesty seams (null-on-malformed, applied:false kept, score clamp) are unit-locked (5 tests)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1003", "read_at": "2026-08-26T15:12:28+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
