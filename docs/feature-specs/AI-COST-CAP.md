# Feature spec — Per-tenant AI-cost cap (finding 6b / cost-metering class)

**Status:** PROPOSAL, build-ready on founder approval of the numbers. Not built (billing/policy decision, §3.3 —
propose don't overtake). Surfaced 2026-07-23 (cost-metering audit), re-confirmed 2026-07-27.

## The problem (from the record)

Two C.A.R.E surfaces generate LLM replies to *externally-supplied* messages, and each bounds cost only BELOW
the tenant level:
- **Public widget** — a customer message triggers an AI reply (`author_type='ai'`).
- **Inbound email** — a customer email triggers an AI auto-reply (`buildCareSystemPrompt` → `generateCareReply`,
  `care/inbound/email/route.ts:688`).

Per-conversation loop-guards exist (`detectAutomatedSender` suppresses bot↔bot loops — good), but there is **no
per-TENANT ceiling**. So distributed abuse — many conversations / many senders, each individually under any
per-conversation limit — produces an **unbounded LLM bill** for the tenant (and for us, since we pay the
provider). This is the one genuine gap left after the loop-guard: a human attacker (or a runaway integration)
fanning out across conversations.

## The agreed design (mechanism)

A **per-tenant windowed AI-reply cap**: before generating an AI reply, count this company's `author_type='ai'`
messages in a rolling window; if it is at/over the cap, **suppress the AI reply and route the conversation to a
human** (inbox) instead of calling the LLM.

Concretely, at each AI-reply decision point (widget handler + `care/inbound/email`):

```
-- count is cheap: care messages already index (company_id, author_type, created_at)-ish
select count(*) from <care messages>
where company_id = $tenant and author_type = 'ai'
  and created_at >= now() - $window;      -- $window e.g. interval '1 hour' and/or '1 day'
```

- **Under cap** → proceed exactly as today (generate + send the AI reply).
- **At/over cap** → do NOT call the LLM. Instead:
  1. Leave the customer message unanswered by AI (no fabricated reply).
  2. Flip the conversation to **needs-human / route-to-inbox** (same path the AI-handoff already uses — reuse
     `[[HANDOFF]]`/needs-human plumbing so agents see it in their queue).
  3. Emit an event/log (`ai_cost_cap_hit`, company_id + window count) so operators see it and §3.1 keeps the
     record. Optionally notify the tenant admin ("AI replies paused — unusually high volume this hour").
- **Recovery** is automatic: as the window slides, the count drops below the cap and AI replies resume. No manual
  reset.

**Why suppress-and-route, not hard-block:** the customer still gets help (a human picks it up) — the cap protects
cost without dropping the customer on the floor. This is the §3.3 / continuity-preserving choice.

## The founder decision (the ONLY thing blocking build)

1. **The cap numbers + window.** e.g. "N AI replies per tenant per hour" and/or "M per day". Pick values that are
   comfortably above a legitimate busy tenant's real volume but below a runaway bill. (Needs a sense of expected
   per-tenant reply volume — start generous, tighten with data, §3.4 honesty.)
2. **Where the cap lives:** a per-tenant column (`companies.ai_reply_cap_per_hour`, nullable → global default) so
   big tenants can be raised without a deploy — OR a single global env default to start. Recommend: global env
   default now, per-tenant override column later.
3. **Notify on cap-hit?** silent+logged, or also email the tenant admin. (Recommend: logged now, admin-notify as
   a fast-follow.)

## Build checklist (once approved)

- [ ] A shared `isUnderAiCostCap(companyId): Promise<boolean>` (or `remainingAiBudget`) helper — one windowed
      count query, used by BOTH the widget reply path and `care/inbound/email` (§A26 — bound both instances with
      one chokepoint, mirroring the injection-fence approach).
- [ ] Wire it before each `generateCareReply` for external-triggered replies (NOT agent-invoked tools like
      co-pilot — those are agent-initiated + already rate-limited; the cap is for AUTO-replies to customers).
- [ ] Over-cap → route-to-human (reuse existing handoff), no LLM call, emit `ai_cost_cap_hit`.
- [ ] Config: env default + optional per-tenant column.
- [ ] Tests: under-cap proceeds; at-cap suppresses + routes + emits; window-slide resumes; per-tenant isolation
      (one tenant's volume never affects another's count).

## What NOT to break

- Agent-invoked tools (co-pilot/formulate/summarize) are agent-initiated and already rate-limited — the cap is
  for **customer-auto-reply** paths only. Don't gate the agent's own tools behind it.
- The customer must never be silently dropped — over-cap ALWAYS routes to a human.
- Per-tenant isolation: the count is scoped to one `company_id`; never a global counter (that would let one
  tenant's spike throttle everyone).
