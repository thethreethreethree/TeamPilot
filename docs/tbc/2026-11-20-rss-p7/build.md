# BUILD - RSS Phase 7: training

Migrations 0282 (training tables) and 0283 (manager_notifications gains 'training_attempted'). D9 open: practice
stays text role-play with its 0-100 focus score. D18 open: the manager screen is built, not mounted.

### Scenarios
write-path: POST /api/coach/remote/scenarios (manager; title, persona, situation, focus, channel, difficulty, length,
optional pass mark, optional source call) → training_scenarios. Never edited; retired once (retired_at, guarded by
rss_guard_scenario_update). No client write policy; the route writes after its own checks.
read-path: GET /api/coach/remote/scenarios (company-wide, RLS rss_scen_select) → TrainingManager scenario list (not
mounted until D18) and the rep's assignment card via /api/coach/remote/assignments.

### Assignments and due dates
write-path: POST /api/coach/remote/assignments → training_assignments, inserting only reps who do not already have
the scenario (tree-filtered, company-pinned); PATCH → training_due_changes row (a due date is never overwritten).
read-path: GET /api/coach/remote/assignments → status derived by assignmentStatus (due / overdue / attempted /
passed / not passed yet) from currentDue + attempts → AssignedPractice on /dashboard/sales-coach/roleplay (rep) and
TrainingManager status table (manager, pending D18).

### Attempts and the manager alert
write-path: role-play route, review phase with assignmentId → assignmentForRep (must be this rep's) → scored against
the scenario's own focus (a client-sent focus is replaced) → training_attempts row with server-computed passed →
notifyTrainingAttempted → manager_notifications type 'training_attempted' to the assigning manager.
read-path: AssignedPractice shows best score / pass state; NotificationBell renders 'training_attempted'.

### Practice follow-up chat
write-path: POST /api/coach/remote/practice-ask (the rep's question about their practice review; Ask Coach turn,
CONVERSATION_IS_DATA fenced).
read-path: PracticeFollowUp under the practice review on the role-play page.

### Gate repairs across Phases 0-7 (found by running the gate for the first time)
write-path: followThrough.ts, interactionStats.ts, trackerScan.ts, assignments route: plain inserts (23505 = already
stored) instead of ON CONFLICT; set-manager returns a fixed sentence for a TreeError; search export through toCsv.
read-path: loadLines and coaching-metrics page past PostgREST's 1000-row cap; call search marks `narrower` when a
match read hits its cap and the search page says so; session length from conversationDurationSeconds.
