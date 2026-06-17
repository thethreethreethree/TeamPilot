# New-tenant operational build — complete hand-off

> Date: 2026-06-17
> Scope: every component shipped after `5b3dcce` to make ELOSTATE
> operational for real new companies signing up.
> Build governance: every commit traced through AMD-006 §1.5.1 four
> layers + cited the relevant ThinkerThinker.md assets.

This is the single doc you need to (a) apply the right migrations,
(b) test the right paths, and (c) know what else to verify before
opening signups.

---

## 1. Migrations to apply (in order)

```
supabase/migrations/0045_tenant_bootstrap_triggers.sql      # done before this round
supabase/migrations/0046_complete_onboarding_rpc.sql        # done before this round
supabase/migrations/0047_onboarding_with_product_context.sql  # NEW — apply this
```

Path: Supabase dashboard → SQL editor → paste the contents of 0047
→ Run. Or `supabase db push` if you have the CLI wired.

**Verify 0047 applied:**

```sql
-- Should return the function with 7 parameters (the 7th is the new
-- p_ai_product_context with default NULL):
select pg_get_function_arguments(p.oid) as args
from pg_proc p
where p.proname = 'complete_company_onboarding';
-- Expect:
-- "p_company_name text, p_industry text, p_size text, p_stage text,
--  p_goals jsonb, p_user_full_name text,
--  p_ai_product_context text DEFAULT NULL::text"
```

If the args column shows only 6 parameters, 0047 hasn't applied —
fix before testing the wizard.

---

## 2. Code paths that landed in this build

| Component | Commit | What changed |
|---|---|---|
| **A. Wizard step 5 — AI product context** | `dbb2f21` | `complete_company_onboarding` RPC now atomically writes product context into care_tenant_config when the founder filled the step. Empty = NULL, Jeff falls back to safe hand-off. |
| **B. Wizard step 6 — Team invites** | `214edd1` | Founder enters teammate emails + roles during signup. Invitations created via the existing `POST /api/team` after the RPC commits. Failed invites don't roll back the onboarding (founder still lands on dashboard, can re-invite from team page). |
| **C. Empty-state copy across modules** | `d7102b3` | Tasks, Chats, Decisions, Problems — empty-state copy revised to actually explain what the module does and how to start, instead of constitution language or "no data". Other modules audited and kept (already had good copy). |
| **D. C.A.R.E first-run domain helper** | `56e732b` | Amber warning banner in widget settings when `allowed_origins=[]`. Tells the operator WHY the list is empty (safety default), WHAT to do (add an origin), and the exact format (https://, no trailing slash). |

---

## 3. End-to-end smoke test — what to verify

Use a fresh email address Supabase has never seen.

### 3.1 Signup + onboarding (the full happy path)

1. Go to `https://elostate.com/login`
2. Click "Set up ELOSTATE"
3. Email + password → submit
4. Confirmation email → click the link → sign in
5. Onboarding wizard appears — **expect 6 steps now**, not 4
6. Fill all steps:
   - Step 1: Company name
   - Step 2: Industry / size / stage
   - Step 3: Goals (at least one)
   - Step 4: Your name
   - Step 5: AI product context — try BOTH (a) skip with empty box; (b) paste a few sentences. Take note of which you used.
   - Step 6: Team invites — try BOTH (a) skip; (b) add 1-2 dummy emails with roles
7. "Launch ELOSTATE" → should redirect to `/dashboard` without error
8. **In Supabase Studio**, verify the following rows exist for the new tenant:

   | Table | Expectation |
   |---|---|
   | `companies` | 1 row, name matches what you typed |
   | `company_brain` | 1 row, company_id matches (trigger 0007) |
   | `care_tenant_config` | 1 row, company_id matches; `ai_product_context` populated IF you filled step 5 (NULL if skipped); `allowed_origins` empty `{}` |
   | `profiles` | your row updated: company_id set, role='admin', full_name matches |
   | `care_agent_state` | 1 row, agent_id = your user id (trigger 0045) |
   | `team_invitations` | one row per invite you entered in step 6 (skip if you skipped step 6) |

### 3.2 Empty-state copy on the new tenant's dashboard

Click through each module — verify the empty-state copy reads as
guidance, not as broken/constitution-jargon:

| Module | What you should see |
|---|---|
| `/dashboard` (Command Center) | "Awaiting evidence" prompt — click "Surface questions" should work without 500 |
| `/dashboard/chats` | "Start your first conversation" with Coach + Co-pilot explanation |
| `/dashboard/operations` | "No tasks yet" with the new "use the composer above" + pattern-spotting copy |
| `/dashboard/decisions` | "No decisions captured yet" + the dialogue-preservation copy |
| `/dashboard/problems` | "No problems yet" + the evidence-required copy |
| `/dashboard/resolutions` | "Resolutions are recorded by closing a problem…" (unchanged, already clear) |
| `/dashboard/diagnose` | Live-empty signals state (unchanged) |
| `/dashboard/brain` | Per-section emptyText messages (unchanged, already clear) |
| `/dashboard/my-growth` | "No recurring principles yet" (unchanged) |
| `/dashboard/care` | Inbox with "Select a conversation" empty state |

If any module 500s or shows a blank panel with no guidance, capture
the error and tell me.

### 3.3 C.A.R.E widget settings — first-run helper

1. `/dashboard/care/settings/widget` — verify the amber banner
   appears above the Allowed origins textarea
2. The banner should say "Your widget won't load anywhere yet" with
   the WHY + WHAT-TO-DO + example URL
3. Type `https://example.com` into the textarea → banner should
   disappear (banner only shows when both saved config AND textarea
   are empty)
4. Save → banner should NOT come back on refresh

### 3.4 Wizard product context → C.A.R.E sees it

If you filled step 5 in 3.1:

1. `/dashboard/care/settings/widget` — scroll to "AI personality"
   section
2. The product context textarea should already have your step-5
   content populated. This confirms the RPC wrote it through.

### 3.5 Team invites → /dashboard/team shows them

If you added invites in step 6:

1. `/dashboard/team`
2. Pending invitations section should list the emails you typed
   with codes you can copy
3. Try copying one of the invite URLs and opening it in a private
   tab — the invite accept flow should work for the invitee

---

## 4. Supabase Auth settings — verify these (from the earlier
   runbook, still required)

These are configured in Supabase dashboard → Authentication →
Settings, not in code:

| Setting | Value | Why |
|---|---|---|
| **Confirm email** | Required | Stops a user signing up with someone else's email |
| **Minimum password length** | 8+ | Default is 6, bump to 8 |
| **Site URL** | `https://elostate.com` | Used for password reset + email-confirm links |
| **Enable signups** | ON | We want public signups |
| **Rate limiting** | Default OK | Tighten if you see abuse |

---

## 5. What's still missing for a full SaaS (not blocking go-live)

For total honesty per AMD-006 layer 3 — the following are gaps that
DON'T block "operational" but you should know exist:

- **No billing / plan tiers.** Per your direction, deferred. Anyone
  who signs up gets the 'pilot' plan with a 200-conversation/month
  quota baked into the config row default. The quota isn't enforced
  anywhere; it's just a number on the row. Adding enforcement +
  payment is its own future work.
- **No team-invite email delivery.** Step 6 creates the invitation
  rows and the codes, but the system doesn't send an email to the
  invitee. The founder copies the invite link from `/dashboard/team`
  and shares it (Slack, manual email, etc.). When you want
  email-delivered invites, that's a separate piece of work
  (transactional email provider integration).
- **No demo/sample data.** Per your "operational, not demo"
  direction. Empty modules show empty states with guidance copy
  — they don't auto-populate with sample content.
- **No first-run walkthrough overlay.** Each module's empty state
  explains itself, but there's no guided tour ("welcome, click here
  first") across the dashboard. This was deliberately scoped out
  per the "operational" not "polished tour" framing.
- **No C.A.R.E widget preview in settings.** You can configure the
  widget but can't see a live preview alongside the config. Tenants
  test by embedding on a staging URL.

If you want any of these to ship before opening signups, tell me
and I'll scope them.

---

## 6. AMD-006 + ThinkerThinker.md compliance — for the record

Every commit in this build had the four-layer trace in its commit
body and cited specific TT.md assets. The artifacts:

```
git log --oneline 5b3dcce..56e732b
```

Each commit body contains the AMD-006 trace (layers 1-4) and TT.md
asset bearings (A4, A5, A7, A8, A11, A13, A14, A18 across the
build). The constitution edit AMD-006 lives at
`docs/amendments/AMD-006-system-and-user-flow-tracing.md` for audit.

---

## 7. Sign-off checklist (the actually short one)

- [ ] Migration 0047 applied (verify with the SQL in section 1)
- [ ] Supabase Auth settings configured (section 4)
- [ ] One fresh signup completed end-to-end (section 3.1)
- [ ] All 6 DB rows landed for the test signup (section 3.1)
- [ ] Every dashboard module loads without 500 (section 3.2)
- [ ] C.A.R.E widget settings banner appears + dismisses (section 3.3)
- [ ] If product context was filled, it shows in settings (section 3.4)
- [ ] If invites were added, they show in /dashboard/team (section 3.5)

When every box is ticked, you can open public signups.

---

Thanks for the trust on the build. If anything in this list comes
back with a problem, the failure-mode tracing in each commit body
should point at the right module to fix. I'm here.
