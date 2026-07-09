# FINDING (2026-07-09) — orphaned signups can get stuck with no company

**Surfaced by** the Elostate member provision for monebertalburomone@gmail.com: that
account **already existed** in `auth.users` but had `company_id = NULL, role = NULL` — a
signup that never got wired to a company. That's why the normal flow felt like it needed
"bypassing": the email was taken but the account was orphaned.

## The mechanism (by design, but with a gap)

`handle_new_user` (0011, SECURITY DEFINER) seeds a `profiles` row on every signup with
`company_id = NULL, role = NULL` — deliberately (§3.4: never invent membership). Company +
role are attached **only** by:
- onboarding (create a company → become CEO), or
- **invite acceptance** (`accept_invitation`, 0008).

So a user who signs up but never creates a company and never accepts an invite is **stuck**:
a confirmed login with a NULL-company profile. Nothing wires them, and there is no
self-service path out.

## Scale (aggregate count, prod, 2026-07-09 — post-fix)

- total profiles: **11**
- orphaned (`company_id IS NULL`): **2**
- `role IS NULL`: **2**

Small (early-stage system), but non-zero and real — after wiring monebertalburomone, **2
other** accounts are still orphaned. At current scale this is a data-hygiene note, not a
fire; at signup-growth scale it becomes a real funnel leak.

## Two gaps worth a decision (flagged, NOT built — §2)

1. **Orphaned-signup dead-end (AMD-006 layer-3 continuity).** What does a NULL-company user
   see when they log in? If it's a broken/empty dashboard with no "join or create a company"
   affordance, that's a workflow dead-end. Worth tracing the post-login experience for a
   company-less user and giving them an obvious next action (create company / enter invite
   code / "ask your admin to invite you").

2. **No admin direct-provision flow.** Adding a member without the invite-accept round-trip
   required a service-role script (`create-tester-accounts.mjs` lineage). A small admin
   "add member directly" action (createUser + wire profile, the sanctioned service path)
   would remove the need to hand-run scripts. Medium value; only worth it if direct-add is a
   recurring need vs. the invite flow.

## Recommendation

Low urgency at 11 profiles. When convenient: (a) decide the company-less login experience
(gap 1 — the higher-value one, it affects real signups), and (b) optionally a
reconciliation pass for the 2 existing orphans (invite them, or remove if they're stale
signups). Gap 2 only if direct-provision becomes routine.

*Recorded per Living Diagnosis — the provision request became an asset revealing a systemic
gap. Aggregate counts only; no individual user data beyond the one account the founder named.*
