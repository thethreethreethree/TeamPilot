# Feature spec — Per-tenant AI-cost cap (finding 6b / cost-metering class)

**Status:** PROPOSAL, build-ready on founder approval of the numbers. Not built (billing/policy decision, §3.3 —
propose don't overtake). Surfaced 2026-07-23 (cost-metering audit), re-confirmed 2026-07-27.

## The problem (from the record)

Multiple C.A.R.E surfaces incur per-call AI/vendor cost, and each bounds cost only BELOW the tenant level (per-IP,
per-user, or per-conversation). None has a per-TENANT aggregate ceiling, so distributed use — many
conversations / senders / agents, each individually under its local limit — produces an **unbounded bill** for
the tenant (and for us, since we pay the providers). Per the 2026-07-23→27 cost-metering audit the cap must cover
**FIVE surfaces**, not just the two obvious LLM ones:

1. **Widget-LLM** — a customer widget message triggers an AI reply (`author_type='ai'`). Only a per-IP 30/min
   limit (IP-spoofable, per-lambda).
2. **Email-LLM** — inbound customer email → AI auto-reply (`care/inbound/email/route.ts:688`). Has loop-breaker +
   per-sender flood-guard + automated-sender suppression, but a spammer rotating human-looking From addresses
   gets independent per-sender counters → no tenant total.
3. **TTS** — `/api/care/tts` (ElevenLabs, billed **per character**). Auth'd + per-request rate-limited, no tenant cap.
4. **STT** — `/api/care/stt` (ElevenLabs Scribe, billed **per minute** transcribed). Same.
5. **Extension tools** — the 7 LLM-burning tools via `guardExtensionRequest` (coach/copilot/dissect/formulate/
   rcd/spawn/summarize), bounded per-IP + per-user (`perUserMax`) but not per-tenant. **This session's auto-trial
   fix WIDENS this**: every pilot auto-unlocks these free for 14 days, so N agents on distinct IPs drive
   N×perUserMax/min aggregate, uncapped at the tenant level.

**Note the cost UNITS differ**: surfaces 1/2/5 are ~LLM-calls; 3 is characters; 4 is minutes. A single
"count author_type='ai'" counter (an earlier draft of this spec) covers ONLY 1 + 2 — it misses voice + tools.
The mechanism below must therefore meter *usage* generally, not just AI reply-messages.

## The agreed design (mechanism)

A **per-tenant windowed usage meter**, checked at every cost-bearing chokepoint. One append-only usage ledger
records each billable AI/vendor operation; before each operation, sum the tenant's recent usage in the window and
compare to the cap.

**Usage ledger (append-only, §3.1):** `care_ai_usage(company_id, surface, units numeric, created_at)` where
`surface ∈ (widget_llm, email_llm, tts_chars, stt_minutes, extension_tool)` and `units` is that surface's cost
unit (1 per LLM call/tool call; character count for TTS; minutes for STT). Index `(company_id, created_at)`. Every
one of the 5 chokepoints appends one row *after* a successful billable call. (Reads can reuse this ledger for a
usage dashboard later — "make learning visible" §3.6.)

**The gate at each chokepoint (before the billable call):**
```
select coalesce(sum(units),0) from care_ai_usage
where company_id = $tenant and surface = $surface     -- OR across all surfaces for a global cap
  and created_at >= now() - $window;
-- if sum + this_call_units > cap[$surface]  → over cap
```
Chokepoints: widget reply path, `care/inbound/email` reply, `guardExtensionRequest`, `/api/care/tts`,
`/api/care/stt`. Prefer PER-SURFACE caps (units differ) OR a normalized-cost total (convert each unit to $ and cap
$/window) — founder decision below.

- **Under cap** → proceed exactly as today (call + append a usage row).
- **At/over cap** → do NOT make the billable call. Instead, per surface:
  - LLM reply surfaces (widget/email): leave the message unanswered by AI and flip the conversation to
    **needs-human / route-to-inbox** (reuse the existing `[[HANDOFF]]`/needs-human plumbing so agents see it).
  - Voice (TTS/STT): return a graceful "voice temporarily unavailable — please type" to the caller (never a raw
    error); the text path still works.
  - Extension tools: return the same "trial/plan limit reached this window" shape the entitlement 402 uses, so
    the panel already renders it.
  - In all cases emit `ai_cost_cap_hit` (company_id, surface, window sum) for operators (§3.1 record) and,
    optionally, notify the tenant admin.
- **Recovery** is automatic: as the window slides, the sum drops below the cap and service resumes. No manual reset.

**Why suppress-and-degrade, not hard-error:** the customer/agent still has a path forward (a human picks up the
chat; voice falls back to text) — the cap protects cost without dropping anyone on the floor (§3.3 continuity).

## Current usage data (live DB, 2026-07-27) — grounds the numbers

Queried production `support_messages` to calibrate: **248 messages all-time across ALL tenants** (customer 134,
**ai 95**, agent 16, system 3). Production C.A.R.E usage is effectively **near-zero** — there is no meaningful
peak-volume to calibrate a tight cap against yet (mirrors the GL: 0 posted entries). Implication, honestly: **set
a GENEROUS safety-ceiling now** — its job today is to stop a *runaway/abuse* spike (thousands of calls), not to
shave normal volume, because normal volume is ~nil. Then tighten with real data as pilots ramp. A tight,
data-driven cap is premature; a generous abuse-ceiling is correct for launch. (Also validates building the
`care_ai_usage` ledger EARLY — it starts collecting the very volume data a future tighter cap will need, §3.6.)

## The founder decision (the ONLY thing blocking build)

1. **The cap numbers + window, per surface** (units differ, so likely a small table of caps, not one number):
   - widget_llm + email_llm: N AI replies / tenant / window
   - extension_tool: N tool calls / tenant / window
   - tts_chars: N characters / tenant / window ; stt_minutes: N minutes / tenant / window
   - OR a single **normalized $-budget** per tenant per window (convert each unit → $ via provider pricing, cap the
     sum). Cleaner long-term; needs the per-unit $ figures.
   Pick values comfortably above a legitimate busy tenant's real volume but below a runaway bill — start generous,
   tighten with data (§3.4 honesty; a guessed-too-tight cap 429s real customers, §5).
2. **Where the caps live:** global env defaults now; a nullable per-tenant override column/table later (raise a big
   tenant without a deploy). Recommend env defaults first.
3. **Notify on cap-hit?** logged now (`ai_cost_cap_hit`); admin-notify as a fast-follow. (Recommend logged first.)

## Build checklist (once approved)

- [ ] `care_ai_usage` append-only table (company_id, surface, units, created_at) + index (company_id, created_at);
      RLS: tenant-scoped SELECT, writes via the chokepoints only (mirror the 0112 brain pattern — no direct member
      write).
- [ ] A shared `checkAiCostCap(companyId, surface, units): Promise<{ok, remaining}>` helper — ONE windowed-sum
      query, used at ALL FIVE chokepoints (§A26 — one chokepoint bounds every instance, mirroring CONVERSATION_IS_DATA).
- [ ] Wire before each billable call: widget reply, `care/inbound/email` reply, `guardExtensionRequest`,
      `/api/care/tts`, `/api/care/stt`. Append a usage row after each successful call.
- [ ] Over-cap degradation per surface: LLM→route-to-human (reuse handoff); voice→"type instead" fallback;
      extension→the entitlement-402 shape. Always emit `ai_cost_cap_hit`.
- [ ] Config: env defaults (+ optional per-tenant override later).
- [ ] Tests: under-cap proceeds + records usage; at-cap degrades gracefully per surface + emits; window-slide
      resumes; **per-tenant isolation** (one tenant's usage never affects another's sum); per-surface independence.

## What NOT to break

- **Agent-invoked in-app tools** (in-app co-pilot/formulate/summarize) are agent-initiated + already rate-limited;
  the cap targets **customer-auto-reply + voice + EXTENSION-tool** paths. Decide deliberately whether the in-app
  agent tools count toward the tenant cap (recommend: no — they're bounded by seat count, unlike the auto-reply
  and free-trial-extension surfaces).
- The customer/agent must never be silently dropped — over-cap ALWAYS degrades gracefully (human handoff / text
  fallback / clear limit message), never a raw error or a blank.
- **Per-tenant isolation**: the sum is scoped to one `company_id`; never a global counter (one tenant's spike must
  not throttle everyone).
- Voice cost is REAL vendor $ (ElevenLabs), not just tokens — don't omit TTS/STT because they're not "AI messages."
