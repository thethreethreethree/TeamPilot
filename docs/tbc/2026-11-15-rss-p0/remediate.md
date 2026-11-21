# REMEDIATE

### A rep could choose their own manager

gate-or-promise: gate

The database guard (0272's `guard_profile_privileged_columns`) raises on any direct authenticated change to
`manager_id`. A SQL harness case (refused for an authenticated self-update, allowed for the service role) is
owed: residual R3.

### is_sales_coach_manager() omits CFO

gate-or-promise: promise

Closed for each table as Phase 0 step 8 moves its policy to rss_can_view_rep; residual R4 tracks the rest.

### A rep could re-score their own pitch through the API

gate-or-promise: gate

The route tests fail if a rep's re-score is accepted, if a reason-less manager re-score runs, or if the
archive does not run before the grading (invocation order is asserted).

### A server-route lockout can be skipped

gate-or-promise: promise

Recorded in the route header and here; decided with D4.

### Manager routes that use the service role bypass the tree

gate-or-promise: promise

Next build step. The gate to add with it: an invariant-audit rule that a route calling requireSalesCoachManager
and writing or reading rep data with the service role must also call the tree check (or be allowlisted with why).

### Segment end times do not exist

gate-or-promise: promise

A founder decision before Phase 2 (residual R5).
