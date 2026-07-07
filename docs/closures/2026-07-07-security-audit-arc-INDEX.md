# Security audit arc — 2026-07-07 (consolidated §1.7 record)

One index for the full authorization/integrity audit that grew out of the founder's
onboarding-audit request. Every finding was verified from source before fixing; three
independent sub-agents did breadth sweeps whose CRITICAL/HIGH claims were re-verified
by hand. Detailed closures: `2026-07-07-onboarding-role-bootstrap-audit.md`,
`2026-07-07-rls-update-withcheck-class-sweep.md`.

## Coverage (every DB + API authz/integrity class)

| Layer / class | Result | Fix |
|---|---|---|
| RLS **UPDATE** — profiles no WITH CHECK | **CRITICAL** — self-set role/company_id → admin of any tenant (defeated 0089) | 0090, 0091, 0092 |
| RLS **INSERT** — profiles + role default 'CEO' | **HIGH** — insert own admin row if bootstrap row absent | 0091, 0092 |
| RLS **UPDATE** — chat_participants | **HIGH** — self-promote to topic admin; self-insert → read private topics (comment claimed a trigger that never existed) | 0093 |
| Storage UPDATE — widget-logos | MED — cross-path relocation (no WITH CHECK) | 0093 |
| RLS **DELETE** — resolutions | MED — member-deletable close-the-loop record (bypassed the update-immutability trigger) | 0094 |
| RLS **UPDATE** — MED tier (10 tables) | MED — no WITH CHECK → tenant-key push-out; care_agent_state agent self-set capacity | 0095 |
| SECURITY DEFINER `search_path` | Clean; my new guard fns pinned to standard | 0096 |
| API **IDOR / object-authz** (26 admin-client routes) | **Clean** — zero CRITICAL/HIGH; 1 nit fixed | 8337296 (agent-upload) |
| RLS **SELECT** (cross-tenant read) | **Clean** — every table RLS-enabled (62/62), tenant/owner-scoped; vendor CRM closed by 0089 | — |
| Event-chain integrity (§3.1) | **Clean** — company_id/actor always server-session-derived, never body | — |
| Input validation (mutation routes) | **Clean** — manual (typeof/whitelist/length) but thorough; RLS + DB constraints backstop | — |

## A23 INSERT-variant sweep (completing the class-check)
The A23 discipline ("one instance → sweep ALL policies of ALL commands") was
discharged for INSERT too: every table where inserting a privileged/owner value
would matter pins the owner column, not just the tenant — coaching_sessions
(`agent_id = auth.uid()`, 0082), coaching segments/cues/cue_outcomes (session-owner
only), after_pitch_summaries (`agent_id = auth.uid()`, 0080), profiles (0091 guard),
chat_participants (0093 guard), care_agent_state (admin-gated insert, 0042). No user
can insert a row attributed to another user or with a privileged column they lack.
So the class-check is complete across SELECT (clean) / UPDATE (fixed) / DELETE
(fixed) / INSERT (clean).

## The through-line (§1.2)
One root pattern under the CRITICAL, the HIGH, and the MED tier: **column-level authz
enforced at the API layer, not the DB** — stated verbatim in 0018/0034/0042 and
assumed-but-never-built in 0033. A direct PostgREST call bypasses the API, so that
assumption is a hole every time. 0090–0096 move the enforcement into the DB (WITH CHECK
+ freeze triggers), where it can't be bypassed.

## Migrations (0089 pre-existing this session; 0090–0096 new)
0089 vendor-scope · 0090 profiles UPDATE guard · 0091 profiles INSERT guard · 0092
drop role 'CEO' default · 0093 chat_participants + widget-logos · 0094 resolutions
no-delete · 0095 MED-tier WITH CHECK + care_agent_state freeze · 0096 pin search_path.

## Founder action checklist
1. **Apply 0095 + 0096** (0089–0094 already applied). Order matters; apply ascending.
2. **Smoke-test the guard triggers (HIGHEST PRIORITY — gates a possible live regression).**
   The guards exempt the "privileged" DB context on the assumption Supabase SECURITY
   DEFINER RPCs run as `postgres`, not `authenticated` (block-list; fails safe toward
   "allow"). Confirm three flows still work post-apply:
   - New-company **onboarding** (complete_company_onboarding sets role='admin').
   - Create a **team-chat topic** (0093 trigger on the creator-seed).
   - Toggle a **support agent** (now a service-role write).
   Any `…is system-managed` / `…may only be changed by` error → paste the string, the
   exemption gets adjusted.
3. **Confirm the deployed `profiles` UPDATE policy matches 0001** (no out-of-band
   dashboard WITH CHECK/REVOKE) — a `\d+ profiles` policy dump.

## Logged, not built (deliberate — §A15)
- Feedback triage / smoke-test authoring stay app-gated per the 0018 "role taxonomy
  still settling" decision (only the tenant WITH CHECK was added, not a role predicate).
- A §3.1 audit event on privileged-column change (defense-in-depth; moot for the attack
  once 0090/0091 block it).

Baseline for future §1.7 comparison (checklist #9). Extends the 2026-07-06 ground-up audit.
