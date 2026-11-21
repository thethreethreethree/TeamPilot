---
started_at: 2026-11-14T21:10:00Z
trigger: Founder 2026-11-15, "this is the build plan" (ELOSTATE Remote Sales System, now docs/rss/), then pickers — remove the off-plan call-page build and start Phase 0; D1 phone + video only; D2 company admins keep company-wide view; D3 re-score archives and flags earlier overrides.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - RSS Phase 0 (foundations), steps 1-8 in this record

## The ask, restated

Build the ELOSTATE Remote Sales System to its plan (docs/rss/, read in full: README, README-PLACEMENT,
BUILD-PLAN/00-BRIEF, docs/00-08). Phase 0 first. This record covers steps 1-4: bring the scaffold in,
author the Phase 0 migration for this repo, the set-manager route, and the manager picker on the Team page.
Steps 5-8 (re-score fix, AI cost ledger, sign-in attempts, switching policies to the tree) follow.

## The record (the plan's "read the live schema" step, done before any file was written)

- coaching_sessions.status is active/ended/reviewed only (0070:42); outcome check already has the five RSS
  outcomes (0077:29). The stage machine has no column; it must be derived (Phase 1).
- context check is ('in_person','video') (0070:36), as the plan assumed.
- rubric_config has one active row per company (0252:79), as the plan assumed.
- recording_share_events is keyed by pitch_id, not session (0260:38): rss_share_granted() must go through
  pitch_scores.session_id (Phase 5).
- coaching_transcript_segments has a start time (spoken_at) and NO end time: the scaffold's stats.ts requires
  endMs > startMs. Raised for Phase 2.
- profiles: the 0001 policy lets each user update their own row; 0090/0091 freeze role, company_id,
  sales_coach_role, is_support_agent only. manager_id becomes access-bearing, so it is added to that guard.
- is_sales_coach_manager() (0252:40) hard-codes CEO/COO/admin; admin_roles() (0265) and the TS authority
  include CFO. rss_is_manager follows admin_roles(); the older function's drift is recorded in check.md.

## Departures from the scaffold, each forced by something that outranks it

- Migration renumbered 0271 → 0272 (0271 taken). Rewritten re-runnable (A12, migration:audit).
- rss_* helpers revoked from clients; rss_can_view_rep answers only for the caller (INVARIANT 4 class).
- manager_id added to the profiles privileged-column guard (the scaffold left a rep able to pick their own
  manager once the tree is switched on).
- Scaffold modules land with their phase step, not all at step 1: reachability:audit fails any src module
  nothing imports. This record lands access.ts + decisions.ts (used by set-manager); rescore, lockout and
  cost land with steps 5-7.
- Reporting lines load through their own GET (/api/team/managers), not fetchTeam, so the roster does not
  fail before 0272 is applied.
- Step 5, no `audit_log` row: that table is Phase 8 (0278 in the plan) and does not exist yet. The archive row
  already records who re-scored, when and why; the audit row is added when Phase 8 creates the table.
- Step 5, prompt version: none existed, so it is derived (hash of the prompt template) instead of a hand-kept
  label nobody would remember to bump.
- Step 5, "manager of the rep" is today's rule (same-company Sales Coach manager, never the rep themselves) until
  step 8 moves it to the tree. There was no re-score button at all, so the API was the only path; a manager-only
  "Re-score this pitch" with a required reason is added to the score panel.
- Step 6, the ledger is written in llmCall itself (every AI call passes through it, including the brain and
  claude.ts wrappers), so no engine can be missed; labels (engine, session) are threaded only where they were
  cheap — pitch scoring end to end, the company for every brain call. A call whose provider reports no usage
  writes no row (zeros would show it as free). Streaming calls and speech-to-text are not metered yet.
- Step 7 (founder picker 2026-11-15, "Build the plan's server route"): both login pages sign in through
  POST /api/auth/sign-in, which records each attempt and runs the lockout rule (inert until D4). Recorded
  limitation: the anon key is public, so anyone can call Supabase's sign-in directly and skip the route; an
  unskippable lockout needs Supabase's CAPTCHA (all plans) or its password-verification hook (Team/Enterprise
  only). The pages fall back to the old direct sign-in when the route itself fails (unreachable/5xx), never on a
  real answer (400/429), so the new hop cannot become a second way to lock everyone out.
- Step 8 (founder picker 2026-11-15, "Automatic once all are set"): a company is on the tree when it has at
  least one active Sales Coach rep and every active rep has a manager (rss_tree_active, 0273). One function,
  rss_tree_allows(rep), narrows the manager branch of each switched policy; before the switch it is true for
  everyone, so behaviour is unchanged. Children of a pitch/session are switched with their parent. Alerts go
  up the manager chain once the company is on the tree.
- Step 6, the vendor view lives beside Session monitoring under /dashboard/admin, behind the same
  vendor-admin gate; prices are entered there (none seeded, none in code).

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-14", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "The plan said to read the live schema for five unknowns before building; the record had to come first.",
   "how_this_build_will_embody_it": "All five read from the migrations and written above before the migration was authored; one (no segment end times) changes Phase 2."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-24", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "The governing methodology and the build plan must be in the working tree, read in session.",
   "how_this_build_will_embody_it": "The plan was copied into docs/rss/ and read in full; CLAUDE.md and ThinkerThinker.md printed at the recorded time."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-80", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "Layer 3: the admin sets managers where they already manage people, and nothing breaks before the migration.",
   "how_this_build_will_embody_it": "The picker sits beside the role picker on the Team page; reporting lines load separately so the roster survives a missing column; each row reads 'reports to X'."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-141", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "Audit what the plan could not see.",
   "how_this_build_will_embody_it": "Found the manager_id self-assignment hole and the CFO drift in is_sales_coach_manager(); one fixed in 0272, one recorded."},
  {"id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-315", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "Who counts as a manager or an admin is already decided by authorities.",
   "how_this_build_will_embody_it": "set-manager builds Person from isAdminRole and isSalesCoachManager; the tree rule is access.ts (TS) mirrored by rss_can_view_rep (SQL), tests on the TS side, the SQL side's tests are the scaffold's PGlite suite (not yet ported)."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-341", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "The re-score archive is the history a re-score must not destroy.",
   "how_this_build_will_embody_it": "pitch_score_archive gets no-update/no-delete rules and no client write policy."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "434-436", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "Item 0: D1-D3 and the fate of the off-plan build were founder decisions.",
   "how_this_build_will_embody_it": "Asked as pickers with recommendations on 2026-11-15; recorded in decisions.ts and the plan's decisions log."},
  {"id": "A10", "source_file": "ThinkerThinker.md", "line_range": "260-260", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "A reporting line decides who sees a person's calls; the person should be able to see it.",
   "how_this_build_will_embody_it": "GET /api/team/managers is readable by any company member, not admins only."},
  {"id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-293", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "The scaffold migration used bare create/alter and would fail the re-apply pass.",
   "how_this_build_will_embody_it": "if-not-exists / or-replace / drop-if-exists throughout 0272."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-455", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "The build plan itself is methodology for this work and lived outside the tree.",
   "how_this_build_will_embody_it": "Copied into docs/rss/ (README-PLACEMENT's instruction) before building."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-594", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "Every citation in this record needs an in-session read.",
   "how_this_build_will_embody_it": "Only clauses listed here are cited."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-770", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "The manager_id hole must be closed by a mechanism, not a note.",
   "how_this_build_will_embody_it": "The database guard refuses it; set-manager's tests pin the tenant filter on read and write."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1001", "read_at": "2026-11-14T21:21:36Z",
   "why_it_governs": "No Node on this machine; npm run check cannot be run here.",
   "how_this_build_will_embody_it": "check.md says so; nothing is called checked."}
]
```
