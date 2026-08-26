---
started_at: 2026-08-27T05:15:00+08:00
---

# THINK — AI-written practice scenarios (pending item 2)

## The ask
Founder pending list: "AI-written practice scenarios tailored to each rep's specific weak spot." Today a focus practice
seeds the prospect with "create moments that test skill X" + a generic persona. This generates a CONCRETE, realistic
scenario (who's at the door, their mood, what just happened) that naturally forces the skill — more engaging + specific.

## The build (reuse the roleplay LLM path; §3.4 honest fallback)
- `practiceScenario.ts` — `buildScenarioSystemPrompt` (corpus-grounded; NEVER names the skill / says "practice" so the
  prospect can't break character) + `parsePracticeScenario` (null on malformed/empty → the caller falls back to the
  plain focus seed, never a fabricated scenario). Shape {title, persona, situation}.
- Route `practice-scenario` (POST, authed, rate-limited 20/min, maxDuration 60, CONVERSATION_IS_DATA fenced) → reuses
  `dissectCoachV5` + `getCurrentSalesCorpus`. Returns {scenario} or {scenario:null} (honest fallback, not an error).
- Roleplay page: when practising a focus, auto-fetch a scenario on the setup screen, show it (title / persona /
  situation) with a "New scenario" regenerate button, and seed persona+situation from it. Falls back to the plain seed
  if generation returns null.

## Injection posture
The scenario route is a NEW external-text/LLM route: it imports and appends CONVERSATION_IS_DATA (same fence as the
roleplay/review), exports maxDuration, and is auth+company gated — satisfying the invariant-audit LLM-route rules.

## Ripple (§6 item 5)
New module + new route + setup-screen additions on the roleplay page. The scored review + the practice event write are
unchanged. Scenario generation is best-effort (a failure leaves the existing focus seed), so it never blocks practice.

## Session-read manifest (A22 — read_at ≥ started_at 05:15:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-12", "read_at": "2026-08-27T05:20:02+08:00",
    "why_it_governs": "Understand the existing seed path before layering scenario generation on it.",
    "how_this_build_will_embody_it": "Reused the roleplay LLM path + corpus; the scenario augments the focus seed, does not replace the scored review." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-08-27T05:20:04+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Cited axioms re-read this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-87", "read_at": "2026-08-27T05:20:06+08:00",
    "why_it_governs": "Layers 2 + 4 — a real, tailored scenario that reads clearly and can be regenerated.",
    "how_this_build_will_embody_it": "Concrete title/persona/situation card + a New-scenario button; silent fallback keeps the flow intact." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-163", "read_at": "2026-08-27T05:20:08+08:00",
    "why_it_governs": "THINK the constraint — a new LLM route must carry the injection fence + maxDuration.",
    "how_this_build_will_embody_it": "CONVERSATION_IS_DATA appended, maxDuration exported, auth+company gated." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-366", "read_at": "2026-08-27T05:20:14+08:00",
    "why_it_governs": "Honesty — no fabricated or blank scenario.",
    "how_this_build_will_embody_it": "parsePracticeScenario null on malformed/empty → fall back to the plain seed; a test locks it." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-435", "read_at": "2026-08-27T05:20:16+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: reused the path, fenced + gated the route, honest fallback, gated the parse." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-456", "read_at": "2026-08-27T05:20:20+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-08-27T05:20:22+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-771", "read_at": "2026-08-27T05:20:24+08:00",
    "why_it_governs": "Gate the lesson.",
    "how_this_build_will_embody_it": "parsePracticeScenario honesty (null on malformed / no-content) is unit-locked (5 tests)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1002", "read_at": "2026-08-27T05:20:26+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
