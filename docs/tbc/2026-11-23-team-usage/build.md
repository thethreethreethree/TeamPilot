# BUILD - Team usage

No migration. No env keys.

### See who uses the product
write-path: none.
read-path: Remote Sales → Coaching → Team usage (TeamUsage.tsx; managers) → GET /api/coach/remote/usage →
requireSalesCoachManager; profiles (company) → treeFilterReps (+ the caller) → coaching_sessions, ask_coach_chats +
ask_coach_turns (role user), training_attempts, remote_prospect_events, each pinned to the company and those people;
emails from each person's sign-in account → login_attempts (succeeded) → buildUsage (usage.ts) → 7/30-day table,
alphabetical, last active; caps named.
