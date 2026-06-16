# C.A.R.E asset audit — 2026-06-16

**Scope.** Every surface shipped under C.A.R.E (Sprints 1–7 + audit P0 closures) audited against the 18 assets in `ThinkerThinker.md`.

**Method.** Asset-by-asset. For each: does it apply to C.A.R.E code, is the code compliant or violating, with file:line evidence and remediation. Outside-view stance per §1.3.

**Why this exists.** Required by `docs/catastrophic-events/CAT-001` — the asset-recovery work the methodology-store-outside-tree failure prevented from happening earlier. Each violation found here is itself an asset captured belatedly per §1.1.

**Severity scale.**
- **P0** — Structural violation. The shipped code embodies the inverse of the asset. Must be reframed, not patched.
- **P1** — Partial compliance with a wrong default. Code is close to the asset's shape but loses load-bearing properties. Fixable with focused work.
- **P2** — Missed opportunity. Not violating, but the asset suggests a stronger design. Defer to rebuild.
- **N/A** — Asset is meta-discipline (governs build process) and was already addressed in CAT-001 + A19.

---

## A1 · Convergence test for external frameworks

**Applies?** Indirect — governs how I integrate external references into the build.
**Status:** N/A (meta-discipline). Did not run a convergence test before integrating Zendesk reference doc against the constitution. **Captured forward** in CAT-001 + A19; next external framework integration will run the test explicitly.

---

## A2 · Design backwards from the §4 readout, not forward from features

**Applies?** Yes — C.A.R.E was scoped feature-forward.
**Status:** **P1 — Partial.** Coach grading has a measurement chain (`support_messages.coach_grade` + `agent_growth_snapshot` aggregation). Resolution Capture + Durability Check chain has measurement (resolution → 7d check → outcome). BUT: no defined §4 readout for the SYSTEM as a whole — "did the C.A.R.E system make the agent team's resolutions more durable than baseline?" is not instrumented end-to-end.
**Evidence:** `src/lib/data/care.ts:619+` (resolutions + durability types), `src/app/api/care/agent/growth/route.ts` (individual growth, not aggregated)
**Severity:** **P1** — instrumentation exists per-feature, system-wide readout missing.
**Remediation:** Define the C.A.R.E §4 readout: hypothesis ("captured resolutions improve durability vs uncaptured"), the alternative ("standard support inbox without resolution capture"), the metric (durability_held rate over 30d), the time window. Without this, every Coach / Pattern / Read Phase contribution to learning is uncomparable.

---

## A3 · Anti-game-your-own-evaluation defaults

**Applies?** Yes — applies to Coach + Co-Pilot.
**Status:** **P1 — Partial.** Coach is default-ON in C.A.R.E (gates by `is_support_agent` only, no per-tenant opt-in flag). Co-Pilot is opt-in via button click ("AI Co-Pilot" button in composer). Coach being default-ON means there is no clean A/B baseline for whether grading improves outcomes vs no-grading.
**Evidence:** `src/lib/care/grader.ts` (no enable flag), `src/components/care/ConversationsApp.tsx:1193` (Coach grade always renders for agent messages)
**Severity:** **P1** — contaminates the §4 readout from day one.
**Remediation:** Add `care_tenant_config.coach_enabled` flag (default off for pilots), surface as A4-style explicit uncertainty in tenant settings.

---

## A4 · Surface design uncertainties; defer them to §4 evidence

**Applies?** Indirect — governs design docs, not code.
**Status:** N/A (meta-discipline). Multiple Coach/Co-Pilot design uncertainties were pre-decided rather than deferred. **Captured forward** in CAT-001.

---

## A5 · Ripple-trace explicitly when adding a gating flag

**Applies?** Yes — `care_tenant_config.active` is a gating flag.
**Status:** **P0 — Violated then fixed retroactively.** When `active` flag was added in migration 0038, it gated NEW conversation creates but not messages on EXISTING conversations. Fix landed in commit `91ba1cf` after the §1.7 audit caught it — but the audit found it because the ripple-trace was not done at flag-add time. This is exactly the A5 failure shape.
**Evidence:** `supabase/migrations/0038_care_white_label.sql:30` (active column), `src/app/api/care/conversations/[id]/messages/route.ts:118-133` (the after-the-fact ripple fix)
**Severity:** **P0 retroactively closed** — the violation was real but is now patched. Counts as a near-miss with on-record diagnosis.
**Remediation:** Forward — every future flag-add commit message includes a ripple-trace section listing all read-sites updated and all deliberately-not-updated sites. Already true for 0038's `active` and 0039's audit triggers in retrospect; make it commit-message discipline going forward.

---

## A6 · The Effective-Task Triad — three pillars only work together

**Applies?** Yes — C.A.R.E should be triad-shaped (understanding gate / accountability / guidance).
**Status:** **P0 — Violated.** C.A.R.E has the Read Phase (Pillar 1 — understanding gate before reply) and Coach + Co-Pilot (Pillar 3 — guidance), but NO Pillar 2 (accountability via transparent presence). The Coach grade has presence-data-shape (when did the agent reply, how long was it pending) but is not surfaced to the agent as an accountability loop. Per A6, shipping Pillar 1 + Pillar 3 without Pillar 2 ships *bureaucracy + feel-good noise without the structural connection between them* — exactly the failure mode A6 names.
**Evidence:** `src/components/care/ReadPhasePanel.tsx` (Pillar 1), `src/lib/care/grader.ts` (Pillar 3), no Pillar 2 implementation anywhere in `src/app/dashboard/care/`
**Severity:** **P0** — structural absence; can't fix by adding metrics, requires designing the accountability surface explicitly.
**Remediation:** Add Pillar 2 surface — agent's own view of (a) conversations they've claimed and not yet replied to, (b) average time-to-first-response over the last 30d, (c) snooze-then-forget patterns. MUST land with A7 + A18 disciplines: every metric has an AI-offered next step, every label invites help not penalty.

---

## A7 · Data about a user is presented with a constructive next step, never as a standalone warning

**Applies?** Yes — Coach grade is data about the agent.
**Status:** **P1 — Partial.** The Coach grade displays `coach_grade` + `coach_reason_internal` but does NOT offer a next step. Per A7: *"the same chart with 'want to push this forward? here's where I'd help' produces movement without shame."* Currently the agent sees `"Coach: needs guidance — read as dismissive in the second paragraph"` with no follow-up affordance. That's a standalone warning, exactly what A7 forbids.
**Evidence:** `src/components/care/ConversationsApp.tsx:1193-1227` (Coach grade render — text only, no action)
**Severity:** **P1** — labels are mostly invitation-shaped already (A18-compliant on the noun) but A7 requires the next-step affordance.
**Remediation:** Add an "Open Co-Pilot with this reason" action below every `needs_guidance` grade. The "next step" is structural: Co-Pilot opens with the Coach reason pre-loaded as the rewrite target. **This also fixes A16 (composition).**

---

## A8 · The System as a growth-aware participant, not neutral infrastructure

**Applies?** Yes — applies to all C.A.R.E copy.
**Status:** **P0 — Mixed.** Internal labels are mostly growth-shaped (`Coach: needs guidance`, `Mine`, `Unassigned`, `Needs first response`). Customer-facing widget copy is tool-shaped (`We're here to help`, `Type a message...`). The widget's introduction is neutral-infrastructure, not growth-participant. Per A8 the test is: *"does it read as a feature, or AS a growth surface?"* Widget reads as a feature.
**Evidence:** `src/components/care/CareEmbeddedWidget.tsx:48-55` (DEFAULT_CONFIG.greeting / subtitle), customer-facing widget messages throughout
**Severity:** **P0 on customer-facing copy; P2 on agent-facing.** Agent surfaces are mostly OK; customer surfaces are not.
**Remediation:** Rewrite widget defaults and per-tenant customizable copy through A8 lens. Add explicit "growth participant voice" guidance to the tenant settings AI personality config. Test: read every default string as a customer who's frustrated and stuck — does it sound like a tool or a participant?

---

## A9 · The builder's submission to the discipline IS the product's credibility

**Applies?** Meta-discipline — the entire CAT-001 catastrophic event IS the A9 violation.
**Status:** N/A — primary subject of CAT-001 + A19. **Captured.**

---

## A10 · The user sees what the System sees about them — no shadow read

**Applies?** Yes — Coach grade is a read about the agent that the leader will see.
**Status:** **P1 — Partial compliance.** Agent CAN see their own Coach grade on every message they sent (renders in inline composer area). Agent CAN see their own growth snapshot via `/dashboard/care/growth`. BUT: there is no surface where the agent can see *what the leader sees about them in aggregate*. Per A10: *"is there a UI surface where the user can see this same data themselves, with the same level of detail?"* — the per-message view passes; the aggregate-as-seen-by-leader view does not exist yet because the leader view doesn't exist yet.
**Evidence:** `src/app/api/care/agent/growth/route.ts:6-12` (agent sees own snapshot, comment notes leader aggregate is "future endpoint"), no leader aggregate endpoint shipped.
**Severity:** **P1 — Deferred-by-deferral.** Not violating yet because the leader view doesn't exist. Becomes a P0 violation the moment the leader view ships without a parallel agent self-view at the same aggregation level.
**Remediation:** Before any leader-aggregate growth view ships, the agent must have a "what your leader sees about you" surface that mirrors the leader's view exactly. Make this a pre-merge gate for the leader endpoint.

---

## A11 · The System does not judge; it mirrors

**Applies?** Yes — Coach is the primary judgment surface.
**Status:** **P0 — Violation at the rubric layer.** The Coach LABELS (`productive` / `neutral` / `needs_guidance`) are mostly invitation-shaped at the noun level — `needs_guidance` in particular matches A18's prescription exactly. BUT: the underlying classification rubric is verdict-shaped. The grader's system prompt explicitly says: *"needs_guidance — reads as dismissive / condescending / evaluation-disguised-as-fact"* — that is the System rendering a judgment on whether the agent's reply *was* dismissive. Per A11: *"the System counts, observes, surfaces — the user decides."* A judgment about whether a reply "reads as dismissive" is exactly what A11 forbids the System from asserting.
**Evidence:** `src/lib/care/grader.ts:27-37` (system prompt issuing verdict-shaped categories)
**Severity:** **P0** — A11 is constitutional. The current Coach is partial-compliance at the label layer and violation at the rubric layer.
**Remediation:** Reframe the Coach rubric from verdict-shaped to count-shaped. Instead of *"this reply reads as dismissive"*, the Coach should surface counts: *"This reply contains 0 acknowledgments of the customer's stated issue, 1 absolute claim, 0 concrete next steps."* Then the agent renders the verdict on whether the pattern is fair. The aggregate over time becomes the count of these counts, not a judgment over them. Heavy refactor — Coach v6 candidate.

---

## A12 · Migrations are safe-to-re-run by construction

**Applies?** Yes — all C.A.R.E migrations 0034–0039.
**Status:** **COMPLIANT.** Spot-checked migrations: `if not exists` on every CREATE TABLE / INDEX, `drop ... if exists` on every trigger drop, `create or replace` on every function. Migration 0038 backfill uses `on conflict (company_id) do nothing`. Migration 0039 uses `create or replace function` to re-emit triggers with `security definer`.
**Evidence:** Confirmed via grep across `supabase/migrations/0034..0039_*.sql`.
**Severity:** None.
**Note:** The A12 discipline was followed by constitutional reflex (the `A12 idempotent` comment header is in every Care migration), not by deliberate consultation of the asset content. The reflex held; the source-consultation gap was not load-bearing here. Worth noting that "constitutional reflex" can carry forward even when the asset source is missing — but A19 makes clear that's not a reliable substitute.

---

## A13 · Vocabulary-once discipline (recurring-miss → category, not word)

**Applies?** Yes — applies to the void-returning DB write functions (silent failure).
**Status:** **P0 — Violated, then patched, structural fix still pending.** Five write functions in `src/lib/data/care.ts` (`setConversationStatus`, `setConversationPriority`, `claimConversation`, `snoozeConversation`, `unsnoozeConversation`) all had the same silent-failure pattern. The fix landed per-function in commit `5798ec5`. Per A13, the right fix is a *shared library at the right altitude* that prevents the next miss without us thinking of it — a `mutateOrThrow(query)` helper or a typed wrapper that makes the silent-failure pattern impossible to instantiate.
**Evidence:** `src/lib/data/care.ts:348-415` (5 functions, all now with `.select().throwOnEmpty` patterns inline)
**Severity:** **P0 — patched at the per-function level, structural fix outstanding.**
**Remediation:** Build `src/lib/supabase/strictUpdate.ts` — a typed helper that takes a Postgres update and throws on zero-rows or error. Refactor the five Care functions + audit the rest of the codebase for the same pattern. The audit step is the A13 lesson: *the same pattern is almost certainly elsewhere.*

---

## A14 · Data path complete ≠ render path complete (verification discipline)

**Applies?** Yes — applies to every multi-state UI feature shipped.
**Status:** **P0 — Fresh violation during this work.** The Close button bug (caught by the user during this conversation, fixed in commit `5798ec5`) is a textbook A14 violation: I claimed the feature shipped after the data path was wired, never opened the render branch to verify, user found the silent failure within minutes. A14 was authored 2026-06-12; the violation occurred 2026-06-16. The discipline failed because I did not consult A14 before declaring the action handler complete. (Same root cause as CAT-001.)
**Evidence:** Pre-fix `src/components/care/ConversationsApp.tsx:482-525` (no error toast on `!res.ok`, no post-action verification)
**Severity:** **P0 — patched but the pre-flight diagnostic was not run.**
**Remediation:** A14's own future-use note codifies the 3-question diagnostic. Add it to the pre-merge checklist as a literal docs/ file the agent must reference before claiming any UI feature shipped: `docs/pre-merge-checklists/UI-FEATURE.md`. Same structural lock-in as A19 applied at the feature-shipped altitude.

---

## A15 · A flag honestly diagnosed may close without a fix

**Applies?** Yes — applies to the §1.7 audit P0 closures.
**Status:** **P1 — Violated by default.** All 7 audit P0s in the §1.7 closure were resolved by *shipping a fix*. None was closed by *on-the-record not-a-defect diagnosis*. Per A15 the diagnostic question to ask before shipping a fix is: *"Does the flagged behavior match a constitutional rule or named asset when read as INTENT instead of as a defect?"* That question was not asked for any of the 7. Some of them (e.g., the polling vs realtime tradeoff) might have warranted a "not-a-defect, deferred to S7" closure instead of the polling patch.
**Evidence:** Commits `91ba1cf`, `dd4ea60` (audit P0 batch + quota — all ship-the-fix closures)
**Severity:** **P1** — not visible damage but the audit-closure discipline was wrong.
**Remediation:** Going forward, every audit-flag closure starts with A15's 3-question diagnostic. Closure-by-diagnosis is a legitimate outcome and must be visible in the audit doc, not hidden behind silence.

---

## A16 · Multiple AI surfaces on the same data must compose, not contradict

**Applies?** Yes — Coach grades + Co-Pilot drafts both operate on the agent's reply.
**Status:** **P0 — Direct violation.** Co-Pilot route (`src/app/api/care/agent/conversations/[id]/co-pilot/route.ts`) makes **zero reference** to `coach_grade` or `coach_reason_internal`. Coach grader (`src/lib/care/grader.ts`) makes zero reference to whether the reply was Co-Pilot-drafted. The two tools operate on the same surface (the agent's outgoing reply) with no composition. This is the canonical A16 failure shape — exactly the Sharpen/Coach example A16 documents.
**Evidence:** Confirmed via grep: `grep -n "coachGrade\|coach_grade\|reasonInternal\|gradeCareAgentReply" src/app/api/care/agent/conversations/[id]/co-pilot/route.ts` returns zero matches.
**Severity:** **P0** — structural. Cannot fix by patching either tool individually.
**Remediation:** Build a composition layer: when an agent invokes Co-Pilot, the Co-Pilot's system prompt receives the most recent Coach grade + reason for the previous reply in this thread as input context. When Coach grades a reply, it knows whether the reply was Co-Pilot-assisted and weighs that into its rubric (a Co-Pilot reply graded `needs_guidance` is a Co-Pilot failure as much as an agent failure). This is the A7 fix surface too — "next step on a `needs_guidance` Coach grade is to open Co-Pilot pre-loaded with the Coach reason."

---

## A17 · A tool that serves more than one human contract must be designed against ALL of them simultaneously

**Applies?** Yes — Coach has technical contracts (identification, guidance) and an experiential contract (does the agent feel they grew).
**Status:** **P0 — The experiential contract was never a design driver.** Coach v5 (the version shipped in C.A.R.E) was scoped against identification (`grade the reply`) and guidance (`reasonInternal explains why`). The experiential contract — "did the agent feel encouraged after seeing this grade" — has zero concrete surface. The grade renders; the reason renders; there is no "what you did well" surface, no "your last 5 replies pattern" surface, no encouragement affordance. Per A17 the diagnostic: *"List the tool's contracts explicitly. For each contract, name one CONCRETE surface or moment where the tool currently serves it."* For experiential contract: ???. That's the A17-named failure exactly.
**Evidence:** `src/lib/care/grader.ts` (no experiential output), `src/components/care/ConversationsApp.tsx:1193-1227` (no encouragement surface in the Coach render)
**Severity:** **P0** — same severity A17 named for the 12-version Coach loop that produced A17 itself.
**Remediation:** Coach v6 must list all three contracts as design drivers. The experiential surface needs concrete shape: (a) "patterns you do well" pinned to the growth view, (b) the Coach reason for `productive` grades is shown to the agent (not just `needs_guidance`), (c) the growth snapshot leads with strengths, not gaps.

---

## A18 · When a system surfaces human-behavior data to a leader, the label IS the structural defense against misuse

**Applies?** Yes — Coach grade WILL be surfaced to leader (aggregate view is queued for S7).
**Status:** **P1 — Partial.** The label *needs_guidance* matches A18's prescription exactly (this was deliberate — A18 was the source). BUT: the labels `productive` and `neutral` were chosen before A18 was consulted in this session and have A18-shape problems. `productive` invites comparison ("was X's reply more productive than Y's?" — a leader's natural read). `neutral` is fine as a descriptor but reads as "below productive" in any ranked display. Per A18: *"read the label as the authority and someone with that label has worked for you for six months. Does it invite you to coach them, or to penalize them?"* The labels `productive`/`neutral`/`needs_guidance`, read as a 3-tier ladder, invite the leader to rank agents — which IS comparison.
**Evidence:** `src/lib/care/grader.ts:44` (the 4-value enum), `src/components/care/ConversationsApp.tsx:1193+` (the badge render)
**Severity:** **P1 — partial compliance at the label layer; structural fix would re-label.**
**Remediation:** Re-label per A18 explicit test. Candidate replacements: `clear` / `template-shaped` / `needs_guidance` / `withheld` — descriptive of the reply shape, not of agent worth. Then in any leader-aggregate surface, NEVER stack-rank agents by grade composition — show distributions per agent, not comparisons across agents.

---

## Audit summary

### Structural violations (P0) — must be reframed, not patched

| Asset | Surface | Reframe scope |
|---|---|---|
| **A6** | Care agent surfaces missing Pillar 2 (transparent accountability) | Add presence/accountability surface; integrate with A7 + A18 |
| **A8** | Customer-facing widget copy reads as tool, not growth participant | Rewrite widget defaults and tenant-config AI personality through A8 lens |
| **A11** | Coach rubric renders verdicts ("reads as dismissive"), not counts | Coach v6 — count-based rubric, user renders verdict |
| **A13** | 5 Care write functions had silent-failure pattern (patched per-function) | Build `strictUpdate.ts` shared helper; audit codebase for same pattern |
| **A14** | Pre-flight diagnostic for multi-state UI features not in place | Add `docs/pre-merge-checklists/UI-FEATURE.md` referenced before "shipped" claims |
| **A16** | Coach + Co-Pilot operate on same surface with zero composition | Add composition layer: Co-Pilot reads Coach state; Coach knows when Co-Pilot was used |
| **A17** | Coach's experiential contract has no concrete surface | Coach v6 — three contracts as parallel design drivers, all visible |

### Partial compliance (P1) — focused work to close

| Asset | Surface | Gap |
|---|---|---|
| **A2** | §4 readout exists per-feature; absent system-wide | Define hypothesis + alternative + metric + window for C.A.R.E as a system |
| **A3** | Coach default-on contaminates the §4 baseline | Add `coach_enabled` opt-in flag |
| **A5** | `active` flag ripple-trace was retroactive, not at flag-add time | Forward — flag-add commits include ripple-trace section by convention |
| **A7** | Coach grade has no next-step affordance | Solved structurally by A16 composition fix — Co-Pilot opens pre-loaded |
| **A10** | Agent self-view of leader aggregate view doesn't exist yet | Pre-merge gate on leader endpoint: must ship with agent self-view |
| **A15** | Audit P0 closures shipped fixes without diagnostic | Going forward — A15 3-question diagnostic before fix-or-close decision |
| **A18** | Labels `productive`/`neutral`/`needs_guidance` invite leader stack-ranking | Re-label per A18 test; ban stack-rank displays in leader aggregate |

### Compliant (no action)

| Asset | Why |
|---|---|
| **A12** | All Care migrations idempotent. `if not exists` / `drop ... if exists` / `create or replace` consistent across 0034–0039. |

### N/A — meta-discipline (governed by CAT-001 + A19)

- A1 — convergence test before integrating external frameworks
- A4 — surface design uncertainties; defer to §4
- A9 — builder submission to the discipline

---

## What the audit found that wasn't on any P0 list

This audit itself is the recovery: each violation above is an asset captured belatedly per §1.1. Total: **7 structural violations (P0), 7 partial-compliance gaps (P1), 1 compliant, 3 meta-discipline.** The lower-severity P2 / opportunity work is absorbed into the rebuild plan rather than enumerated here.

The most damning finding: **the audit was tractable in one pass** because the asset library, once in the working tree, made every violation immediately visible. A14 makes the Close button bug obvious. A16 makes the Coach/Co-Pilot non-composition obvious. A11 makes the rubric verdict-shape obvious. *Every violation here would have been caught at design time if A19 had been in place at the start of Sprint 1.* The cost of CAT-001 is the seven P0 reframes this audit identifies; the prevention going forward is A19.

## Rebuild order — recommended

1. **A14 lock-in** (cheapest, prevents the next instance): write the pre-merge UI checklist file.
2. **A13 structural fix** (small library, broad impact): `strictUpdate.ts` + codebase audit.
3. **A16 composition layer + A7 next-step** (one fix, two assets recovered): Co-Pilot reads Coach state.
4. **A11 + A17 + A18 — Coach v6** (the big one): count-based rubric, three contracts, re-labeled. Treat as a single coordinated rebuild because the assets are intertwined.
5. **A6 — Pillar 2 surface** (accountability with A7+A18 disciplines built in from the start).
6. **A8 — customer-facing copy rewrite** (cosmetic-feeling but constitutionally load-bearing).
7. **A2 + A3 — system-wide §4 readout + Coach opt-in flag** (instrument honestly before the rebuild compounds).
8. **A10 + A15** — pre-merge gates on the leader aggregate view + the audit-closure 3-question diagnostic.

This sequence respects A6 — none of these surfaces ship in isolation. The Coach v6 rebuild (#4) gates the leader-aggregate view (#8). Pillar 2 (#5) requires the relabeled Coach (#4). The §4 readout (#7) requires both Pillar 2 and relabeled Coach to be in place to define the comparison.

---

*Recovery is on-record disclosure (CAT-001) + on-record audit (this document) + structural prevention (A19 + the pre-merge checklists this audit names). The next test of whether the discipline took will be whether the next class of structural failure gets caught BEFORE it has time to compound.*
