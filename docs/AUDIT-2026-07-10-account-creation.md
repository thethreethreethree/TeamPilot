# AUDIT — Team / Account-creation system (2026-07-10)

Triggered by the founder ("multiple account-creation related bugs"). Audited against
CLAUDE.md + ThinkerThinker.md, AMD-006 foremost. Standard quoted below; every finding
cites the specific clause, quotes real code, and states where else the class was checked.
**This is not a clean bill of health** — §"Inspected vs not" lists exactly what I opened.

## The standard (quoted from source, read this session)

- **AMD-006 four-layer sieve** (docs/amendments/AMD-006, addendum L164-189, foundation-up):
  (1) structure efficiency → (2) operational effectivity ("does the feature, invoked the
  way a real user would, deliver the intended result?") → (3) synergetic composition
  ("does invoking it leave the surrounding workflow intact or broken?") → (4) UI/design.
  §1.5.1: *"technically complete but operationally isolated… is incomplete and must not ship."*
- **A25** — resolve an external identifier by matching the FIELD + assert cardinality; *a
  false MATCH is worse than a miss.*
- **A27** — a surface that PROMISES an invariant the write path does not ENFORCE is a false
  guarantee; enforce below the label, don't hide the control.
- **A23** — an RLS write policy constraining a row's identity but not its authz-bearing
  columns is a privilege-escalation class.
- **A13** — vocabulary-once: finite literal sets driving runtime behaviour defined once, by
  category, consumed by reference.
- **A14** — data path complete ≠ render/branch path complete; verify every branch.
- **A16** — multiple surfaces on the same data must compose, not contradict.
- **A8** — the System is a growth-aware participant (onboarding / empty states are growth
  surfaces, not dead ends).
- **A26 / A29** — a bug is one instance of a class; sweep to the boundary; a recent fix is a
  sweep anchor.
- **§3.1** — events are the append-only chain; state transitions must emit.

---

## FINDINGS (most severe first)

### F1 — HIGH — Invite acceptance never verifies the accepting user's email
**File:** `supabase/migrations/0008_team_invitations.sql:105-154` (`accept_invitation`), reached via `src/app/api/team/accept/route.ts:36` and `src/app/invite/[code]/page.tsx:74-81`.
**Clause:** A27 (promise-not-enforced) + A25 (match the FIELD) + AMD-006 Layer 2 (effectivity).
**Evidence (quoted):**
```sql
v_user_id := auth.uid();
select * into v_invite from team_invitations where code = p_code;
-- validates: accepted_at / revoked_at / expires_at  … then:
insert into profiles (id, company_id, full_name, role, status)
  values (v_user_id, v_company_id, p_full_name, v_invite.role, 'active')
```
There is **no comparison of the caller's email to `v_invite.email`** at any layer. `invite/[code]/page.tsx:56` even lets the visitor `supabase.auth.signUp({ email, password })` with an arbitrary email and then accept. `team_invitations.email` is immutability-protected (0008:54) — the design *intends* email to bind — and `invite/[code]/page.tsx:137` tells the user *"one email means one person, so this is what ties your contributions to you"*. The write path enforces none of it.
**Impact:** anyone holding an invite **code** (forwarded link, leaked URL, shared channel) can accept it with any account and join the company **at the invite's role** — which can be `CEO`/`COO` → company admin. The invited person is not who joins.
**Class check:** the other identity-resolution site, `findAuthUserByEmail` (admin.ts:37), *does* match the email field (fixed 2026-06-28). The onboarding RPC binds to `auth.uid()` (self, no external identifier). So invite-accept is the one unenforced identity binding — but it is the highest-value one (it grants tenant membership + role).

### F2 — MED — `member.joined` event is skipped when an orphan becomes a member
**File:** `supabase/migrations/0008_team_invitations.sql:169-170` (`emit_member_joined_event`).
**Clause:** §3.1 (state transition must emit) + A14 (a branch of the data path never fires).
**Evidence (quoted):**
```sql
if (TG_OP = 'INSERT' and NEW.status = 'active' and NEW.company_id is not null) or
   (TG_OP = 'UPDATE' and NEW.status = 'active' and OLD.status <> 'active' and NEW.company_id is not null) then
```
`handle_new_user` (0011) seeds a signup profile with `status='active', company_id=NULL`. When that orphan is later wired to a company (via `accept_invitation`'s `on conflict do update`, or a service-role provision), the UPDATE branch requires `OLD.status <> 'active'` — but the orphan was **already** `'active'`, so the condition is false and **no `member.joined` event emits**. The actual join is the `company_id` NULL→set transition, which the trigger doesn't test.
**Impact:** members onboarded from an existing orphaned signup never enter the §3.1 chain as "joined" — no event, no derived signal. (Confirmed live: monebertalburomone's provision this session produced no `member.joined`.)
**Class check:** this is the only member-lifecycle emitter; the orphan class is quantified in F5 (2 orphans / 11 profiles).

### F3 — MED — App duplicate-invite guard and the 0098 unique index disagree on expiry
**File:** `src/app/api/team/route.ts:99` vs `supabase/migrations/0098_...sql:43-45`.
**Clause:** A16 (two enforcement layers must compose) + AMD-006 Layer 2 (re-invite must work).
**Evidence (quoted):** app guard rejects only a *non-expired* pending invite —
```js
if (existingInvite && new Date(existingInvite.expires_at) > new Date()) { …409… }
```
the DB index occupies the slot for *any* non-accepted/non-revoked invite regardless of expiry —
```sql
create unique index … on team_invitations (company_id, lower(email))
  where accepted_at is null and revoked_at is null;
```
**Impact:** when a pending invite **expires** and the admin re-invites the same email, the app guard passes (expired → condition false) but the DB index rejects the insert → the route returns the raw Postgres unique-violation as `error.message` (team/route.ts:145), a confusing 500 instead of a working re-invite. (`now()` is not immutable, so the index *cannot* exclude expired rows — the app layer must be the one to reconcile.)
**Class check:** this is the only place two layers guard invite-uniqueness; the sibling false-ok write bugs (member-removal 558ce56, revoke) were already fixed in the same route (A29 anchor) — this is the remaining unswept composition instance.

### F4 — MED-LOW — Role vocabulary is authored in ≥4 incompatible places (A13)
**Files:** `src/app/api/team/route.ts:8` `["CEO","COO","Lead","Member"]`; `src/lib/supabase/auth-helpers.ts:11` `ADMIN_ROLES=["CEO","COO","admin"]`; `0046/0047` onboarding assigns `'admin'`; scripts/provision assign `'member'`; `0008:33` check `('CEO','COO','Lead','Member')`.
**Clause:** A13 (vocabulary-once) + A21 (same concept across modules).
**Evidence:** the founder is created as `role='admin'` (0046:88 `values (…, 'admin')`), invitees as Title-case `{CEO,COO,Lead,Member}`, and `0008:8`'s comment *"the company founder with role='CEO'"* is **factually wrong** vs the code. auth-helpers.ts:6-9 itself documents *"~12 sites that currently inline `role === 'CEO' || 'COO' || 'admin'`."*
**Impact today:** **not a live mis-grant** — I swept ~20 inline gates (team-check, care/leadership, coach/sales-session/*, notifications, feedback, chat/topic-decisions) and they all use the same `CEO||COO||admin` triple, which covers both admin-producing values. The cost is drift risk: any future role change must be edited in ~20 places (the exact A13 failure), and the invite UI can't assign `'admin'` while the founder *is* `'admin'`.
**Class check:** swept all inline `role ===`/`includes` sites (see the sweep in the session log). One genuine cross-vocabulary confusion: `chat/topic-decisions/route.ts:91` `participant.role !== "admin"` reads `chat_channel_members.role` (0010: `admin/member/observer`) — a *different* table's role, A21 "same name, different feature." Not a bug, but a readability trap.

### F5 — MED — Direct signup with no invite dead-ends at create-company only
**Files:** `src/app/dashboard/layout.tsx:71-72` (redirect to `/onboarding`) + `src/app/onboarding/page.tsx` (create-company wizard; **no join-existing path**).
**Clause:** AMD-006 Layer 3 (continuity — does the feature leave the user flowing or stalled?) + A8 (growth participant, not dead end).
**Evidence:** a company-less user is redirected to `/onboarding`, which only creates a *new* company (and can invite others). There is no "I have an invite / join an existing company / enter a code" affordance on that surface. The invite-*link* path (`/invite/[code]`) works, but a user who signed up **directly** (no link) has no in-app route to join an existing company — they can only create one.
**Impact:** confirmed live — aggregate count 2026-07-09: **11 profiles, 2 orphaned** (`company_id NULL`). monebertalburomone was exactly this (signed up, orphaned, needed an out-of-band manual wire). At signup-growth scale this is a funnel leak; recorded in `docs/FINDING-2026-07-09-orphaned-signups.md`.

### F6 — LOW — Invite role copy in Learning-Mode hint doesn't match the actual roles
**File:** `src/app/dashboard/chats/page.tsx:186`.
**Clause:** A18 (the label is the interface) + AMD-006 Layer 4 (surface must match substance).
**Evidence (quoted):** *"Pick a role (CEO / COO / Admin / Member / Support agent …)"* — but the real invite roles (team/route.ts:8, 0008:33) are `CEO / COO / Lead / Member`. The copy invents `Admin` and `Support agent`, and omits `Lead`.
**Impact:** low — a hint mis-describes the role dropdown; a user is told "Admin"/"Support agent" are invite roles when they are not.
**Class check:** `dashboard/team/page.tsx:146` (the actual invite surface) does not enumerate roles, so it's not wrong — the mismatch is isolated to the chats-page hint copy.

### F7 — LOW — `findAuthUserByEmail` matches the field but doesn't assert single cardinality
**File:** `src/lib/supabase/admin.ts:37-` .
**Clause:** A25 (the second half — *assert cardinality*).
**Evidence:** it pages and returns the first row whose `email` matches (correct — this fixed the 2026-06-28 bug), but the create-tester precedent notes an email *"can map to more than one auth.users row (a stale signup + the active account)"*. Returning the first match could pick the stale row.
**Impact:** low — affects the duplicate-member guard's accuracy in the rare duplicate-email case. The field-match (the part that mattered) is correct.

---

## Remediation plan

| # | Fix | Clause it satisfies | Risk the fix introduces |
|---|-----|--------------------|--------------------------|
| **F1** | In `accept_invitation`, before attaching: look up the caller's email (`auth.users.email` for `auth.uid()`) and `raise exception` unless it equals `v_invite.email` (case-insensitive). SECURITY DEFINER can read `auth.users`. | A27, A25, AMD-006 L2 | A legit user invited at one email but signed in with another is now **blocked** — this is the intended tightening, but it needs a clear error ("this invite was sent to X; sign in as X") so it doesn't read as a bug. Decide policy: exact-match vs allow admin override. Runtime-test on staging (email lookup under DEFINER). |
| **F2** | Add a third emit condition: `OR (TG_OP='UPDATE' and NEW.status='active' and OLD.company_id is null and NEW.company_id is not null)`. Guard against double-emit by making the branches mutually exclusive. | §3.1, A14 | Double-emit if a single UPDATE both flips status→active AND sets company_id from null; mitigate by `OLD.status <> 'active' OR OLD.company_id is null` as one combined predicate. Backfill decision: do the 2 existing orphans-since-wired need retroactive events? |
| **F3** | Before insert, **auto-revoke** any existing pending (incl. expired) invite for `(company_id, lower(email))`, then insert — OR reject *all* pending (expired included) with "revoke the existing invite first." Align the app predicate to the index predicate exactly. | A16, AMD-006 L2 | Behaviour change to re-invite: auto-revoke silently supersedes the old invite (probably desired). Must confirm 0098 is applied per-env before relying on the index (the recurring "never assert applied"). |
| **F4** | Author the role space once (extend `auth-helpers.ts`): export `ALL_ROLES` + `INVITABLE_ROLES` + keep `ADMIN_ROLES`; migrate the ~20 inline gates to `isAdminRole()`; reconcile onboarding (`'admin'`) with the invite set (add `'admin'`/`'Admin'` as an invitable admin role, or make the founder `'CEO'`); fix the 0008:8 stale comment. | A13, A21 | Touching ~20 gates risks changing gate behaviour — do it as a pure refactor with a test asserting each gate's admit/deny set is unchanged. Do NOT bundle with a role-value migration of existing rows without a data check. |
| **F5** | Add a "Join an existing company" path to `/onboarding` (and/or the post-signup empty state): an invite-code entry that calls `accept_invitation`. Makes the orphan self-serviceable. | AMD-006 L3, A8 | Low — additive UI. Depends on F1 (the code path must be email-verified first, or it inherits F1's hole). |
| **F6** | Correct the chats-page hint copy to the real set (`CEO / COO / Lead / Member`), or better, source it from the shared `INVITABLE_ROLES` (ties to F4). | A18, AMD-006 L4 | None. Follow-up polish commit. |
| **F7** | When multiple auth rows match the email, prefer the one whose `profiles` row is company-linked (mirror the owner-lookup in create-tester-accounts.mjs); assert/log if >1. | A25 | None material; strictly narrows a rare wrong-pick. |

**Sequence:** F1 first (only HIGH; but it's a DEFINER change → stage + runtime-test, like 0112). F2/F3 next (data-integrity + effectivity). F4 as a scoped refactor with a behaviour-preservation test. F5/F6 additive. F7 opportunistic.

---

## Inspected vs NOT inspected (no clean bill beyond this list)

**Inspected this session (evidence-backed above):** `0008` (full — invitations, `accept_invitation`, immutability trigger, `emit_member_joined_event`), `0011` (`handle_new_user`), `0046`+`0047` (onboarding RPCs), `0090`+`0091` (privileged-column guards — **sound**, A23 closed), `0092` (role default null — **sound**), `0098` (unique index — present), `0045` (tenant bootstrap — **sound**, fail-safe empty origins), `team/route.ts` (full), `team/accept/route.ts` (full), `auth-helpers.ts` (isAdminRole/getCurrentCompanyId), `admin.ts` (`findAuthUserByEmail` — core **sound**), `onboarding/page.tsx` (create + inline invites), `invite/[code]/page.tsx` (accept surface), `dashboard/layout.tsx` (onboarding gate).

**NOT inspected — no judgement offered on these:** `0010` team_chat role model (`chat_channel_members.role` — the A21 sibling vocabulary; worth a follow-up), `0017` (invite delete policy), `0024`/`0064` (avatar/logo), `login/page.tsx`, `auth/recover/page.tsx`, `sales-coach/login/page.tsx`, `care/leadership/team` + `coach/sales-session/team` (read surfaces), `dashboard/team/page.tsx` full render, the email-delivery path for invites (whether the invitee actually receives the link).

*Audited against the framework as written. Findings have quoted evidence; none fabricated,
and the HIGH was not omitted to appear successful. §1.7 on-record audit.*
