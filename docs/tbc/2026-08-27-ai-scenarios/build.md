# BUILD — AI-written practice scenarios

### the generator (prompt + parse)
- write-path: `practiceScenario.ts` — `buildScenarioSystemPrompt(corpus)` (corpus-grounded; never names the skill or
  says "practice"), `buildScenarioUserMessage(focus)`, `parsePracticeScenario` (```json fence tolerant; null on
  malformed / no persona-and-situation). Shape {title, persona, situation}.
- read-path: a concrete scenario object, or null → the caller uses the plain focus seed.

### the route
- write-path: `practice-scenario/route.ts` (POST, authed, company-scoped, rate-limited 20/min, maxDuration 60,
  CONVERSATION_IS_DATA fenced) → `dissectCoachV5` → `{ scenario }` (null on empty, an honest fallback not a 5xx).
- read-path: the roleplay page fetches a scenario for the focus.

### the surface
- write-path: `roleplay/page.tsx` — on the setup screen for a focus practice, auto-fetch a scenario (once), show a
  "Your scenario" card (title / persona / situation) + a "New scenario" regenerate button, and seed persona+situation.
- read-path: the rep drills a concrete, realistic situation tailored to their weak spot; regenerate for a fresh one.

## Files
- `src/lib/coach/v5/practiceScenario.ts` — prompt + parse.
- `src/lib/coach/v5/__tests__/practiceScenario.test.ts` — 5 honesty tests.
- `src/app/api/coach/sales-session/practice-scenario/route.ts` — generation route (fenced, gated, maxDuration).
- `src/app/dashboard/sales-coach/roleplay/page.tsx` — scenario card + fetch + seed.

## Ripple (§6 item 5)
New module + route + setup UI. The scored review + practice event write are unchanged. Best-effort generation (null →
plain seed) so practice never breaks. New LLM route carries the injection fence + maxDuration (invariant-audit rules).

## Honest limit
The scenario seeds the situation (persona + context); the scored review still judges the drilled skill. A scenario is
not persisted (each practice generates fresh), consistent with the roleplay's stateless design.
