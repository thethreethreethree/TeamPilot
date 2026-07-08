# Team invite + removal audit — 2026-07-07

Founder-reported bugs (two, same feature), audited against ThinkerThinker.md +
CLAUDE.md with specific attention to AMD-006. All fixes shipped + gate-green.

## Standard I audited against (quoted, so it is explicit)

- **AMD-006 addendum, Layer 2 — operational feature effectivity** (docs/amendments/
  AMD-006-...md:168): *"does the feature, when invoked the way a real user / caller /
  consumer would invoke it, deliver the intended result? Not 'does the unit test pass'
  — does it actually work."* And the sieve (line 176-178): *"Broken effectivity is
  not survivable by polish… do not advance past a broken layer hoping a later one will
  mask the issue."*
- **AMD-006 Layer 3 — synergetic composition** (line 170): does invoking it leave the
  surrounding workflow intact; **Layer 4 — UI/design** (line 172): is the surface
  honest to the human operating it.
- **AMD-006 second addendum §1.5.2 — proactive audit** (line 213-215): audit adjacent
  surfaces; *"a bug rarely lives alone; if the audit lens is on, look around."*
- **CLAUDE.md §2 — Diagnose before patching** ("State the root cause and *why* it
  produces this symptom. Only then propose a change.").
- **CLAUDE.md §1.2 — Retrospective Identification** (identify from the actual record of
  what happened, detect patterns across incidents).
- **CLAUDE.md §3.4 / ThinkerThinker.md A11** — the System must not assert a fact that
  isn't true; a failed action must be visible, not silent.
- **ThinkerThinker.md A23** — authz-bearing columns are DB-frozen; every reader trusts
  the writer. **The strictUpdate lesson** — a write that affects 0/wrong rows must be
  asserted, not assumed.

## Confirmation I read the actual built files (not memory)

Inspected this session, in full: `src/components/team/InviteMemberDialog.tsx`,
`src/app/api/team/route.ts` (all handlers), `src/lib/supabase/admin.ts`,
`src/app/api/team/accept/route.ts`, `src/app/api/care/agent/settings/agents/route.ts`,
`src/app/api/care/inbound/email/route.ts` (customer resolve), `src/app/dashboard/
team/page.tsx` (remove/revoke handlers), and the migrations `0001_init.sql` (profiles
RLS), `0008_team_invitations.sql` (invitations RLS + accept_invitation), `0090/0091`
(profile column guards). AMD-006 read in full from `docs/amendments/`.

---

## ISSUE 1 — CRITICAL — invite names the WRONG person as "already a member"

- **File/location:** `src/lib/supabase/admin.ts:37-60` (`findAuthUserByEmail`), consumed
  at `src/app/api/team/route.ts:107-123`.
- **Clause violated:** AMD-006 Layer 2 (operational effectivity) + §3.4/A11 (false
  assertion about a person) + the §1.2 record (the identical 2026-06-28 `?email=`
  incident).
- **Evidence (quoted):**
  ```
  GET /auth/v1/admin/users?email=${encodeURIComponent(email)}
  const u = data.users?.[0];          // first user in the list
  if (!u || !u.email) return null;
  return { id: u.id, email: u.email }; // never checks u.email === email
  ```
  GoTrue's admin list endpoint does not filter by `?email=` on this instance — it
  returns the first page of ALL users. Taking `users[0]` without verifying its email
  meant every lookup resolved to whoever sorts first in auth.users (Rebecca), so the
  invite route reported her as "already a member" for any email invited — blocking
  ALL invites and stating a falsehood about her.
- **Severity:** CRITICAL (feature fully broken + false statement about a real person).
- **Same class elsewhere (checked, not assumed):** `findAuthUserByEmail` has ONE caller
  (team route). No other `admin/users?email` or `listUsers` usage exists; no
  `/api/admin/users` route exists. All other email lookups (`support_customers`,
  `team_invitations`) use PostgREST `.eq("email")` on real tables with unique
  constraints + `.maybeSingle()` — a correctly-filtering mechanism, NOT this class.
  **Isolated.**
- **Fix (shipped 46f1bf5):** page through `admin.auth.admin.listUsers` and match the
  `email` field EXACTLY (case-insensitive, trimmed); never trust `users[0]`. Returns
  null (soft-fail) if service-role env absent. **Clause satisfied:** Layer 2 + §3.4.
  **Risk introduced:** for an instance with >200 users the loop pages (bounded 50×200);
  only runs on invite creation (rare). Locked by 5 regression tests incl. direct repro.

## ISSUE 2 — MEDIUM — duplicate-pending-invite guard is self-defeating

- **File/location:** `src/app/api/team/route.ts:83-99` (duplicate-prevention #1).
- **Clause violated:** AMD-006 Layer 2 (a guard that doesn't guard) + A23/§A12
  (cardinality should be structural, not a per-query hope).
- **Evidence:** `team_invitations` has no unique constraint on `(company_id, email)` —
  only `code` is unique (0008). The guard used `.maybeSingle()`, which ERRORS on 2+
  rows → `data` null → guard silently skipped → another duplicate created. Once two
  exist, the guard is permanently bypassed for that email.
- **Severity:** MEDIUM (annoying duplicate state, not harmful; masked by the common
  single-row case).
- **Same class:** related to Issue 1 (assumed cardinality ≠ actual). Swept — no other
  duplicate-guard has this shape.
- **Fix (shipped ae7eddf):** `.order(invited_at desc).limit(1).maybeSingle()` (works at
  any count) + migration 0098 (revoke older dupes, then a PARTIAL UNIQUE INDEX on
  `(company_id, lower(email)) where pending`). **Clause satisfied:** Layer 1 (structural)
  + Layer 2. **Risk:** migration 0098 modifies existing rows (revokes older dupes) —
  founder-applied; re-run-safe.

## ISSUE 3 — CRITICAL — removing a member silently does nothing

- **File/location:** `src/app/api/team/route.ts` DELETE `memberId` branch (was 174-181).
- **Clause violated:** AMD-006 Layer 2 + §3.4 (phantom success) + the strictUpdate
  lesson + A23 (profiles locked down without a legitimate admin-write channel).
- **Evidence (quoted, old):**
  ```
  const { error } = await c.supabase
    .from("profiles")
    .update({ status: "removed", removed_at: ... })
    .eq("id", memberId);
  if (error) return 500;
  return NextResponse.json({ ok: true });
  ```
  The profiles UPDATE policy is self-only (`0001:110 using (id = auth.uid())`). An admin
  updating another member's row matched 0 rows, returned no error, replied ok. The list
  filters `status='active'`, so the member never left. Also: the endpoint had **no admin
  check at all** — it was "safe" only because RLS silently no-op'd everyone.
- **Severity:** CRITICAL (core admin action broken + latent authz gap).
- **Same class (checked, not assumed):** swept every profiles write on another user's
  row. The only correct sibling — `care/agent/settings/agents` (is_support_agent) —
  already uses the right pattern, and its own comment names this exact trap. The team
  route was the one place that never adopted it. No other broken instance.
- **Fix (shipped 558ce56):** verify caller is admin (`isAdminRole`) → soft-remove via
  service-role admin client scoped to `.eq("company_id")` → ASSERT a row was affected
  (404 if not). **Clause satisfied:** Layer 2 + §3.4 + closes the authz gap. **Risk:**
  the admin gate is now load-bearing (admin client bypasses RLS) — added explicitly.
  NOT unit-tested (DELETE handler needs a mock harness); build-verified + mirrors the
  proven care route — flagged honestly.
- **Recreate-account continuity (Layer 3, verified):** after removal, re-invite is
  unblocked (dup-check sees status≠active) and `accept_invitation` (0008,
  `on conflict do update set status='active'`) reactivates the profile. Same auth
  account reused — §3.1 history preserved. A truly fresh account (new user id) would
  require an auth.users hard-delete, which this system intentionally does not do.

## ISSUE 4 — LOW — the Team page swallowed failed removals

- **File/location:** `src/app/dashboard/team/page.tsx` remove handler.
- **Clause violated:** §3.4 + AMD-006 Layer 4 (the surface hid the failure) — this
  silent-swallow is *what masked Issue 3*.
- **Evidence:** `if (res.ok) onRemoved();` — a non-ok response was dropped, no feedback.
- **Severity:** LOW on its own, but it is the reason Issue 3 was invisible for weeks.
- **Fix (shipped 3d34a89):** show `toast.error` with the route's message on failure.
  **Risk:** none. (The revoke handler was left unchanged per founder call.)

---

## What I inspected vs. did NOT

- **Inspected + judged:** the invite create path (dialog → POST → dup-checks →
  findAuthUserByEmail → insert); the accept path (`accept_invitation`); the remove path
  (DELETE memberId → RLS → list filter → UI handler); the revoke path (DELETE
  invitationId → team_invitations RLS); profiles + team_invitations RLS policies; the
  one sibling admin-write (care agent toggle); the care inbound email customer-resolve.
- **Did NOT fully inspect (no clean bill of health claimed):** (a) the invite/revoke
  **authz level** — both are currently any-company-member, NOT admin-gated; I did not
  change this (founder decision: should inviting/revoking require admin, like removal
  now does?). (b) Cascade cleanup on removal — a removed member's `care_agent_state`,
  `chat_participants`, task assignments, etc. are NOT touched by the soft-remove; I did
  not audit whether any of those need to react to removal. (c) Runtime verification of
  all three fixes against the live DB — build-verified only; the founder's own re-test
  is the confirmation (per the verification-discipline memory).

## Open questions for you
1. Should **inviting** and **revoking** require a company admin (removal now does)?
2. Should removal **cascade** (revoke agent state / chat participation / task
   assignments), or is soft-remove-from-roster the intended scope?
