# CHECK - RSS Phase 0, steps 1-4

## Commands

None. This machine has no Node, so `npm run check` was not run, nor any part of it; the scaffold's own
99 tests (PGlite) were not run either. Migration 0272 is not applied: the Supabase project is suspended
(docs/SUPABASE-QUOTA-OUTAGE-2026-11-11.md), and the plan's "Looked at" for step 4 (an admin sets managers
for a real team) cannot happen until it is.

Done instead, and it is not a substitute: the set-manager test cases worked by hand against the route; the
rules of rls:audit, reachability:audit, writer:audit and invariant-audit 4, 18, 26 and 29 read and the new
files written to them.

The full `npm run check` output must be appended below before commit.

## Findings

### A rep could choose their own manager

class: an access-bearing profiles column outside the privileged-column guard
sweep: `grep -n "is distinct from OLD" supabase/migrations/0091_guard_profile_privileged_columns_on_insert.sql supabase/migrations/0272_rss_p0_foundations.sql`
severity: high

The 0001 policy lets a user update their own profile, and 0090/0091 freeze only four columns. The scaffold
added `manager_id` without extending the guard, so once policies switch to the tree a rep could re-parent
themselves out of their manager's view. Fixed in 0272.

### is_sales_coach_manager() omits CFO

class: a role list hard-coded in SQL instead of admin_roles()
sweep: `grep -rn "in ('CEO', 'COO', 'admin')" supabase/migrations`
severity: low

0252's predicate predates 0265's single source. A CFO is a manager in TS and in the new rss_* helpers but
not in policies that use is_sales_coach_manager(). Not changed here: changing it widens existing access.
Phase 0 step 8 replaces those policies with rss_can_view_rep, which closes it for the tables it touches.

### A rep could re-score their own pitch through the API

class: a rule enforced only by hiding a button
sweep: `grep -rn "skipIfScored: false" src/app src/lib`
severity: high

The route passed skipIfScored:false for every caller; the store replaces the score and deletes its evidence.
Fixed: resolveScoreRequest decides, and a re-score archives first.

### A server-route lockout can be skipped

class: enforcing an auth rule in our app while the auth provider's endpoint is public
sweep: `grep -rn "signInWithPassword" src`
severity: medium

The anon key is public; Supabase's sign-in endpoint accepts it directly. Founder chose the plan's route anyway
(2026-11-15); it records attempts from our pages. Real enforcement is a D4-time choice between Supabase CAPTCHA
and the Team-plan password-verification hook.

### Manager routes that use the service role bypass the tree

class: an access rule enforced by RLS, bypassed by service-role reads and writes
sweep: `grep -rln "requireSalesCoachManager" src/app/api | xargs grep -l "createAdminClient"`
severity: high (once any company is on the tree)

Ten routes: patterns, patterns/event, pitch-score (covered: it reads the session through RLS first),
pitch-score/override, pitch-score/disputes, pitch-score/leaderboard, pitch-recordings/comment,
pitch-recordings/share, coach-assessment/dashboard, gamification/calibration. Each checks only the company, so a
manager outside a rep's chain could still act on that rep by id. Must be closed before any company completes its
tree, which cannot happen before 0272/0273 are applied.

### Segment end times do not exist

class: a plan input the live schema does not hold
sweep: `grep -rn "end_ms\|ended_at" supabase/migrations/*segment* supabase/migrations/0070_live_sales_coach_foundation.sql`
severity: medium

The scaffold's stats.ts requires endMs. To be decided before Phase 2.
