# AMD-003 — Per-company brain as the §3.4 implementation

- **Status:** ratified
- **Date:** 2026-05-16
- **Proposed by:** founder directive ("plug in DeepSeek as the brain of the system, but each integration/company has their own self-learning AI system based on their company's character/system")
- **Affects:** `src/lib/claude.ts` and every diagnosis surface that calls an LLM; introduces `src/lib/llm/`, `src/lib/brain/`, migration 0007, `/dashboard/brain`.

---

## Trigger

The current implementation calls Claude with a **static system prompt** for every
company. The `analyzeOperations`, `analyzeFinance`, `analyzeMarketing`,
`proposeDecisionDialogue`, `analyzeConversationDialogue`, `generateDailyQuestions`,
`generateOutsideViews`, and `traceRipples` functions all share this property: same
prompt, no company context, no accumulated learning.

This is a **direct violation of §3.4** ("The System has no fixed day-one behavior.
Behavior is derived from each team's accumulated data. A system that behaved identically
for every customer on install would be claiming understanding it cannot have — a lie.
Refuse to build that.").

It is also a **violation of §3.6** ("Continuous adaptation the user cannot perceive is
indistinguishable from stagnation"). The product has no surface for "what the System has
learned about this company" because the System has not been built to learn.

Documented incidents (structural-gap shape, supplemented by violations that were
already on the record):

1. The 2026-05-16 audit (in session) named "every LLM surface ships the same prompt"
   among the §3.2/§3.4 violations and listed it pending.
2. The fix shipped for §3.2 (Understanding Gate, AwaitingEvidence) and §3.3 (guide-don't-
   overtake dialogues) deliberately did NOT address §3.4 — that closure was deferred
   to this amendment.

## Diagnosis

The existing rule (no per-company context in LLM calls) produces three failure modes:

- **Sameness as lie.** Each company sees the System speak as if it knew them, while in
  fact the System has no per-company memory. This is the "knowledge imitating
  intelligence" failure (§5) at the product layer: fluent and confident, not earned.
- **No path to §3.6 visibility.** Without a per-company memory store, there is no "what
  the System learned" surface that can exist. The §3.6 commitment becomes structurally
  unmeetable.
- **No path to §4 method evolution per company.** Each company's diagnostic loop has
  no way to refine its own methods based on what worked here vs. there. The System
  treats every company as the first one forever.

Root cause: the LLM provider was integrated as a stateless call-site, not as an
accumulating per-company runtime. The fix is structural — add the brain layer and
inject it into every LLM call.

## Ripple-trace

- **§3.4 (no fixed day-one behavior).** Directly implemented by this amendment. The
  brain starts empty; behavior diverges per company over time.
- **§3.6 (make learning visible).** Implemented by `/dashboard/brain` which surfaces the
  brain's contents, evolution log, and version. The user can perceive growth.
- **§4 (evolving the method itself).** The brain is the per-company memory that future
  method-evolution work depends on. AMD-003 is the foundation under that future work.
- **§7.5 (distrust of evolution).** Brain updates must be append-only with the
  triggering evidence recorded. A brain update without a stated reason is not
  acceptable.
- **§3.5 (measurement of consequence).** Brain "validated methods" should only be
  derived from resolutions where `durability = 'held'`. Updating the brain from
  unreviewed resolutions would treat acceptance as success — the forbidden failure mode.
- **§3.4 (Month 1 = control).** Brain accumulates from day 1, but AI guidance output
  is suppressed for the first 30 days per company. This is the structural guarantee
  that the "no instant results" honesty constraint holds.
- **§1.3 (outside-perspective).** The brain must not silence outside-view generation
  by over-fitting to a company's existing assumptions. The brain addendum biases
  *style and vocabulary*, never *which assumptions to challenge*. This is named here
  to prevent a future drift where brains become echo chambers.

No section is loosened or contradicted.

## Alternative-test

Structural-gap shape. The current alternative is "every company gets the same prompt"
which the diagnosis section identifies as a §3.4 violation in itself.

Comparison metric for future validation (§4): per-company resolution durability rate
(% `durability='held'`) with brain on vs. brain off. AMD-003 is provisional until that
rate is measurable. Per §7.5, AMD-003 is itself eligible for counter-amendment if the
data shows brain-mediated diagnoses produce *less* durable resolutions than
brain-less ones — i.e. if the brain overfits and adds confidence without earning it.

## Outside-view check

Read with no stake:

- Does this loosen §3.2 (Understanding Gate)? **No** — gate is still enforced at the
  DB layer. The brain biases *how the System speaks*, not whether it is permitted to.
- Does it open a back-door to overtake (§3.3)? **No** — guide-don't-overtake dialogues
  still require user diagnosis + proposal first. The brain influences phrasing and
  vocabulary, not the structural interrupt.
- Does it create a Rule-5 risk (builder under pressure loosening)? **Yes, one** — a
  builder under pressure might use the brain to make outputs "more confident" to satisfy
  a customer who wants "more decisive AI". Section 7.4 + the brain_evolution_events
  audit trail are the structural protections. Any change to the brain's behavior shape
  requires an amendment, not just a config flag.
- Does it create a §3.6 lie risk (showing fake "learning")? **Possibly** — a brain that
  updates from every event would look very active but be churning on noise. The
  validated-methods restriction (only from `durability='held'` resolutions) is the
  guard against this.

Passes with the named risks flagged. The brain visibility surface MUST clearly distinguish
what was learned from held outcomes vs. what was learned from unreviewed events.

## Proposed change

No text change to `CLAUDE.md` is required — the constitution already prescribes §3.4
and §3.6. AMD-003 is the *implementation* of those sections, not an amendment of their
text. This file is the authoritative record of why the implementation exists in the
shape it does.

Implementation artifacts:
- `supabase/migrations/0007_company_brain.sql`
- `src/lib/llm/` (provider abstraction, DeepSeek primary)
- `src/lib/brain/` (load + compose + learn)
- `/api/brain/*` routes
- `/dashboard/brain` page
- Refactor of all existing LLM call sites to accept `companyId` and use the abstraction

## Decision

**Ratified** — founder directive + soundness gate passed (with the two flagged risks
recorded for §7.5 monitoring).

## Status Update — 2026-05-16

Ratified. Implementation in progress.
