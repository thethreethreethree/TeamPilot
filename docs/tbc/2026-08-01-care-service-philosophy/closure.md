# CLOSURE — C.A.R.E service philosophy injection

## What shipped
A single `SERVICE_PHILOSOPHY` standard — synthesized from the founder's two source documents (a
legendary-hospitality service methodology + a premium relationship-care message structure) — now shapes
every reply the C.A.R.E system produces: the customer-facing auto-reply and all four agent-draft tools
(Co-Pilot + Formulate, in-app + extension). It makes replies *see* the customer, meet the feeling, reassure
with what's real, give a specific next step, add one proactive thing, and close warm — and it gives the AI a
real service-recovery discipline (own it, tell the truth, no half-measure, hand off for remedies it can't
grant). Scoped to C.A.R.E only, as directed. A guard test locks it into every surface.

## Un-named reliance (not self-evident)
- The sources are internal IP and are deliberately NOT named in the prompt — verified by reading the
  constant, not assumed. The customer experiences the behavior, never the framework.
- The recovery clause does NOT loosen the "AI cannot grant refunds/exceptions — hand off" rule: the honesty
  rules emit first and the clause defers to them in-text. Verified by section order in
  `buildCareSystemPrompt` + the explicit deferral line, not assumed.
- Summarize intentionally does NOT carry the philosophy (it's a read, not a reply) — asserted by the guard
  test's `.not.toContain`, so a future "add it everywhere" refactor can't silently misapply it.
- The per-tenant tone setting still composes: the philosophy fixes SHAPE + care; the tone line fixes
  register (warm/formal/direct). Both still reach the prompt.

## Follow-ups
- A behavioral (not just wiring) test — feed a sample complaint + assert the draft owns it and hands off
  rather than promising a refund — would strengthen this; deferred (needs an LLM mock harness). Wiring +
  the honesty-rule ordering are the load-bearing guarantees today.
- Founder report delivered separately (PDF) summarizing the before/after improvement.
