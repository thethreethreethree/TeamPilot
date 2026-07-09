# FINDING (HIGH, FLAGGED — fix ready, not applied) — company_brain is member-writable = company-wide prompt injection (2026-07-09)

**Verified to ground. Not fixed in a migration — the fix is a security-mode change to the learning-cycle core that I cannot runtime-verify; flagged with the ready SQL for your review + runtime test.**

## The finding

`composeSystemPrompt` (brain/index.ts:191) injects `company_brain.system_prompt_addendum` into **every** LLM system prompt for a company (via `runBrainCall`/`runBrainStream`). The RLS on `company_brain` is a single `for all using/with check (company_id = auth_company_id())` policy (0007:114) — company-scoped, **no role gate, no column constraint.** So any authenticated member can:

```sql
UPDATE company_brain SET system_prompt_addendum = '<arbitrary instructions>'
WHERE company_id = <their company>;
```

…and that text is then prepended to every AI call their company makes — the **customer-facing C.A.R.E replies**, the coach, dissects, summaries. A member (or a compromised member account) can steer or poison the company's entire AI behavior, and it also **bypasses the append-only `brain_evolution_events` audit** (§3.1) — the 0007 comment itself admits "direct UPDATE… works but is non-auditable, a §3.1 violation… expected to never" — but *expected-to-never* is convention, the RLS **allows** it. Insider / within-tenant (not cross-tenant), but HIGH: it corrupts customer-facing output and defeats the §3.6 "make learning visible / honest learning" thesis by letting fabricated "learning" in.

## Why it's not a simple guard (like 0111)

The sanctioned mutate path `record_brain_learning` is **SECURITY INVOKER** (0007:15), and the learning route `/api/brain/learn` is **not admin-gated** (only `getCurrentCompanyId`), and `runLearningCycle` uses a **user-scoped** client. So the legitimate learning path writes `company_brain` **as the member** — meaning members currently *need* direct UPDATE for the real feature to work. A plain role-gate or column-freeze would break the learning cycle. The auto-create trigger `create_empty_brain_for_company` (0007:68) is invoker too.

## Recommended fix (ready — review + RUNTIME-TEST before applying; touches the learning cycle)

Decouple "the audited RPC can write" from "members can write directly" by privileging the sanctioned paths, then denying direct member writes:

```sql
-- 1. Make the sanctioned mutate path privileged (bypasses RLS), pin search_path (per 0096).
alter function record_brain_learning(...) security definer;   -- add: set search_path = public
-- 2. Auto-create must also not depend on the inserter's RLS.
alter function create_empty_brain_for_company() security definer; -- set search_path = public
-- 3. Restrict company_brain to SELECT for members; deny direct INSERT/UPDATE (definer paths write).
drop policy "company_brain - all" on company_brain;
create policy "company_brain - select" on company_brain
  for select using (company_id = auth_company_id());
-- (0108 company_brain_no_delete already blocks DELETE; no member INSERT/UPDATE policy → default-deny.)
-- 4. Same treatment for brain_evolution_events (the audit table — only record_brain_learning writes it).
```

**Why NOT applied blind:** making `record_brain_learning` + `create_empty_brain_for_company` DEFINER changes who they run as; if anything subtle breaks (a table the owner can't see, `auth.uid()` semantics, the member-triggered learning cycle) the learning cycle / brain auto-creation could fail silently — and I cannot exercise the learning cycle or company onboarding headless. This is precisely the "genuinely necessary but risky, verify first" case. **Apply on staging, run a learning cycle + create a test company, confirm the brain still composes + learns, then promote.**

**Sub-item — /api/brain/learn spam: RATE-LIMITED (fixed 2026-07-09).** The route was
member-triggerable with no bound, so a member could spam the LLM-heavy learning cycle
(cost). Checked the caller: the brain page is member-facing (no admin gate), so admin-gating
the route would BREAK member access — instead added a rate-limit (`brain-learn`, 5/hr/caller),
which hardens the cost surface without changing who can use it. Admin-gating the whole
brain-learn flow (page + route) remains a genuine PRODUCT decision (should learning be
leadership-only, like the §3.4 unlock?) — flagged, not decided.

## Sibling instance (same class) — members can fabricate their OWN chain events → self-inflate ELO

Generalizing: the root class is **an integrity-critical table whose sanctioned write
path is SECURITY INVOKER / user-scoped, so members must have direct INSERT/UPDATE
permission — which they can abuse to write fabricated data directly, bypassing the
path's validation.** Two instances:

1. `company_brain` (via `record_brain_learning`, invoker) → prompt injection (above).
2. **`events`** (via `record_event`, invoker at 0004:60, + the invoker emit triggers,
   + many user-scoped route inserts): the `events - all` INSERT policy (0103) checks
   `company_id = auth_company_id() AND (actor = auth.uid() OR actor is null)` — but has
   **no constraint on `kind` or `payload`.** So a member can direct-PostgREST-insert a
   fabricated `coach.dissect_generated` event with `actor = self` and a payload showing
   all-strengths/no-growth, and `getAgentEloGames` (salesElo.ts:217, reads
   `coach.dissect_generated` by `actor = agentId`) counts it → **the member inflates
   their OWN §3.5 ELO.** This is a RESIDUAL of 0103 (which closed cross-actor spoofing —
   `actor` must be self — but not self-fabrication) and of the same class as the brain.
   MED (within-tenant self-gaming of a performance metric, not cross-tenant).

### Full class boundary (swept 2026-07-09) — all member-fabricable integrity tables

| Table | Member can write? | What they can fabricate | Severity |
|---|---|---|---|
| `company_brain.system_prompt_addendum` | UPDATE (for-all, company) | instructions injected into EVERY AI call incl. customer-facing | **HIGH** |
| `events` (coach.dissect_generated, actor=self) | INSERT (0103, no kind constraint) | own coaching dissects → self-inflate ELO | MED |
| `after_pitch_summaries` (agent_id=self) | INSERT (0080, owner-scoped) | own pitch scores → self-inflate ELO | MED |
| `coaching_sessions` (agent_id=self) | INSERT (0082, correctly owner-scoped) | own sessions → self-inflate ELO | MED |
| `brain_evolution_events` | INSERT only (for-all, but no-update+no-delete rules from 0007:103/105 hold) | can ADD fake "learning" audit entries; CANNOT erase/tamper real ones (append-only is intact) | LOW-MED |

All five share the root cause and the remediation. 0102/0103 closed the CROSS-actor
paths (can't fabricate for OTHERS); this is the SELF/company residual (fabricate your
OWN records, or company-shared brain/audit). Note the ELO inputs are *supposed* to be
self-created (an agent records their own session) — so the fix isn't "deny self-insert"
but "ensure the CONTENT (scores, dissect verdicts) is written by the grader/coach
system, not client-suppliable" — i.e., the graded fields come from a DEFINER/service
path, and members can create the shell row but not the score.

### CORRECTION (2026-07-09, traced to ground) — the dissect emission is SERVICE-ROLE, not user-scoped

The claim above ("`coach.dissect_generated` emission is USER-SCOPED, dissect/route.ts")
was WRONG — it mistook the dissect route's user-scoped READ (`.select().eq("kind",…)`,
existence check) for the emission. Traced every reference: the ONLY insert of
`coach.dissect_generated` in the codebase is **`salesDissect.ts:102` via
`createAdminClient()` (service-role)**. So a member has NO legit path to emit it, and the
fix is safe-by-construction — a NARROW kind-constraint on the events INSERT policy:

```sql
-- Ready. Verified: salesDissect.ts:102 (service-role) is the sole emitter of this kind.
drop policy if exists "events - all" on events;
create policy "events - all" on events
  for all
  using (company_id = auth_company_id())
  with check (
    company_id = auth_company_id()
    and (actor = auth.uid() or actor is null)
    and kind <> 'coach.dissect_generated'   -- NEW: block member fabrication of the ELO dissect event
  );
```

**Why this is FLAGGED for your review, NOT auto-staged (unlike 0112/0113):** it edits the
`events` INSERT policy — the single most critical RLS policy in the whole §3.1 chain. A
typo here breaks EVERY event insert (a CAT-class outage) for a MED-severity fix. Editing
the crown-jewel policy autonomously, under the continuous build mandate, is precisely the
§5 "builder under pressure" risk. Apply on staging, insert a normal event + run the chain
test, confirm nothing breaks, then promote.

**Broader open question (separate §3.5 audit, NOT resolved here):** of the 14 `coach.*`
event kinds, 7 are emitted SERVICE-ROLE (dissect, intel, moments, pivot, summary,
status_changed, outcome_recorded) and **7 are emitted USER-SCOPED** (review, after_pitch
[marker only — the scores live in the 0113-locked table], decision, analyze, debrief,
grade_sent, observe). A broad `kind not like 'coach.%'` constraint would BREAK those 7
legit user emitters. Before any broad reserved-kind restriction, someone must map which
coach.* events actually FEED a score (only those need the harder "move emission to
service, then restrict" treatment). `coach.dissect_generated` is the one confirmed
ELO-feeding + service-only kind, hence the narrow fix above.

**Bearing:** §3.1 (append-only / auditable chain + brain), §3.4/§3.6 (honest, visible learning), §3.5 (ELO/measurement integrity), §2 (surface don't overtake — flagged not shipped), A26 step 4 (flag the risky/decision ones). Verified from source 2026-07-09.
