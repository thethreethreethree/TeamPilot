# App-wide write-authorization audit — the "route-only-admin gate" class (2026-08-20)

> Consolidates the app-wide security work that grew out of the schedule build. The per-finding detail and the
> live behavioral proofs live in `docs/audits/2026-08-19-schedule-ground-up-audit.md`; this is the clean,
> findable summary + the reusable method, because the class is app-wide (not schedule-specific) and recurs.

## The class

**A route enforces a role/authority gate that the database does not.** Concretely: an API route checks
`isAdmin` / `requireCareAgent` / an approver capability before a write, but the underlying table's RLS is only
*company-scoped* (any member of the company) and `authenticated` holds a direct write grant — OR the write RPC
checks the role only at the route, not inside the function. PostgREST exposes every table and `SECURITY
DEFINER`/invoker function, so a member can **bypass the route** with a direct call. Within-tenant (never
cross-tenant when `company_id`/`auth_company_id()` is enforced), but it defeats the role model.

**This codebase has hit it 5+ times:** `0089`, `0090`, `0111` (the §3.4 control window), and the schedule/care
findings below. That recurrence is why the fixes are now *gated* (below), not just patched.

## Findings + fixes (all live-verified in rolled-back transactions, real users)

| # | Surface | Bug | Fix |
|---|---------|-----|-----|
| 1 | `apply_schedule_import` | `create or replace` + added param → TWO overloads → 3-arg call ambiguous | `0225` drop the stale overload |
| 2 | `companies.timezone/workweek_start` | admin gate route-only; RLS company-scoped | `0226` BEFORE-UPDATE trigger (`guard_company_schedule_settings`) |
| 3 | `append_schedule_event`, `apply_schedule_import` | RQ6 manager-only gate route-only (RPC checked company, not role) | `0227` role check inside both RPCs (`auth_is_schedule_manager`) |
| 4 | `auth_is_schedule_manager(company)` | DEFINER + tenant param, client-callable | `0228` guard the param vs `auth_company_id()` |
| 5 | `schedule_employee` | roster writes company-scoped (member could add/edit/delete staff) | `0229` admin-only INSERT/UPDATE/DELETE |
| 6 | `schedule_event` (**critical — 3 supersedes 5's RPC fix**) | company-scoped `ALL` policy + direct INSERT grant → member `POST`s a manager-only event DIRECTLY, bypassing the RPC | `0230` RQ6 on the TABLE (INSERT check) + manager-only reads |
| 7 | `emit_care_durability_due_event` | DEFINER, client-executable, cross-tenant write from an unguarded id | `0231`/`0232` revoke from public/authenticated/anon (functions default GRANT-TO-PUBLIC — revoke PUBLIC too), keep service_role |
| 8 | `support_customers` | company-membership writes; route uses `requireCareAgent` → non-agent member bypass | `0233` agent-or-admin write policy |

## Verified SAFE (spot-checked by reading the live policy / RPC body — NOT assumed)

- **Finance** — sensitive ops gate authority as the **first statement** of the RPC: `fin_approve_bill` /
  `fin_post_entry` → `fin_can_approve()`; `fin_close_period` → `fin_can_manage_periods()`; `fin_close_year` →
  `fin_can_configure()` (controller/CFO). Plus a `company <> auth_company_id()` tenant check and posted-entry
  immutability triggers. Draft-write tables are member-appropriate data entry. **No fraud vector.**
- **Chat** — `close_topic` checks admin internally; `decide_chat_topic_decision` / `close_problem` carry no
  role gate but are collaborative-by-design (RLS-scoped, participatory diagnostic/chat).
- **`files`** — RLS is `uploader_id = auth.uid() OR <CEO/COO/admin>` (matches the route). Not a bypass.
- **`pitches` / `after_pitch_summaries`** — owner-scoped (`rep_id`/`agent_id = auth.uid()`).
- **`care_tenant_config`, `care_agent_state`** — role-checked policy / column-guard trigger respectively.
- **Care operational tables (verified directly, not via recon):** `support_conversations` / `coaching_sessions`
  UPDATE are agent/role-gated (profiles-subquery incl. `is_support_agent`/role); `support_messages` INSERT is
  owner-scoped (`author_id = auth.uid()`); `care_rcd_conversations` / `care_rcd_messages` / `coaching_cues`
  have NO client write policy (RPC/service-written + immutability triggers). No bypass. The care sweep is thus
  fully verified, not reasoned.
- **Core** (problems / signals / tasks) — VERIFIED collaborative: `company_id = auth_company_id()` write
  policy AND no core write route gates `isAdmin` (so no admin action is being bypassed). `resolutions` adds a
  soft owner association (`decided_by`/`reviewer = auth.uid()`). Member-writable by design (the Living
  Diagnosis is participatory, §3.3).

**Conclusion: no critical route-only-admin write bypass exists app-wide.** The only real instances were
schedule + care, all fixed + gated.

## Gates in place (A30 — so the class can't silently return)

- `verify:live` (30 invariants), added this arc:
  - **schedule RPCs single-overload** (catches the `0225` overload-orphan footgun).
  - **authz-guard triggers wired** (9 triggers, incl. the `0111` guard gap-fill).
  - **service-only care RPC not client-executable** (`emit_care_durability_due_event`).
  - **schedule/care write policies retain their role/agent predicate** (a revert of `0226/0229/0230/0233` to
    company-scoped FAILS — detection-proven).
- Drift-guard test: the manager-only event list agrees across route TS == `0227` RPC == `0230` RLS.

## Reusable method (for the deferred finance/chat draft-table confirm)

**The recon heuristic OVER-FLAGS — do not act on it directly.** A query for "company_id table + company-scoped
write policy + no role term + `authenticated` write grant" produced ~40 candidates that were almost all false
positives:
- It missed `profiles`-subquery scoping (a blind spot — under-counted at first).
- Its owner-column exclusion list is incomplete (e.g. it had `uploaded_by` but not `uploader_id`, false-flagging
  `files`), so it over-counts.
- It can't see a role/capability check that lives *inside* a `SECURITY DEFINER` RPC (finance).

**The reliable method is per-candidate:** read the FULL write policy (`pg_policies.with_check/qual`, untruncated)
AND, for RPC-written tables, the RPC body's first guards. Classify as: role/agent-gated (safe) · owner-scoped
(safe) · RPC-gated-internally (safe) · collaborative-by-design (safe) · **company-membership-only with a
role-gated route (BYPASS — fix)**. Only the last is actionable.

## Deferred (founder's call, low-urgency — no critical bypass known)

- A per-table confirm of the finance/chat draft-write tables using the reliable method above.
- A standing app-wide GATE for NEW instances would need a `MEMBER_WRITABLE_ALLOWLIST` (classify each
  company_id write table once, with a reason — the RPC_ONLY_TABLES pattern in `invariant-audit.mjs`); most of
  the classification is done above.
