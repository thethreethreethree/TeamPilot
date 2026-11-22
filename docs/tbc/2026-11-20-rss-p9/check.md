# CHECK - RSS Phase 9

## Commands

```
npm run check exit 0
  invariant:audit Violations: 0
  Test Files 789 passed | 1 skipped (790); Tests 6038 passed | 15 skipped (6053)
  migration:audit, sql:harness SKIPPED — no reachable Postgres (NOT a pass)
```

PGlite 16.4, 284 migrations applied and 0271-0286 re-applied (16/16), then:

```
OK   endpoint
ERR  http endpoint refused → 23514 webhook_endpoints_url_check
OK   session closes / deal sold / score stored / re-save outcome sold again
deliveries: [session.closed, deal.closed, session.scored] — has_transcript false, has_label false (3, not 4)
due: 3 at attempts 0
attempt 1 failed → right after a failure, still due? 0      (backoff)
attempt 2 ok → after success, due: 0
ERR  edit url refused → P0001 RSS: a webhook endpoint never changes
OK   turn off; ERR turn back on refused; off endpoint: due count 0
exit 0
```

The plan's "Looked at", as a test (webhooks.test.ts): a fake receiver captures the POST sendSigned makes;
verify(endpoint secret, X-Elostate-Timestamp, raw body, X-Elostate-Signature) is true, and false under another
endpoint's secret. Not done against a real receiver on a deployed server (needs the secret set and 0286 applied).

## Findings

### F1 - one shared signing secret lets any customer forge another's webhooks
class: a verification secret shared across tenants — a receiver must hold it to verify, so every holder can sign.
sweep: `grep -rn "RSS_WEBHOOK_SIGNING_SECRET" docs/rss src` → the plan (05-ROUTES, 08-DEPLOYMENT, scaffold webhooks.ts)
uses it directly as the HMAC key; src derives a per-endpoint key (endpointSecret) and nowhere signs with the master.
severity: high

### F2 - the scaffold's delivery log updated attempts in place
class: a retry counter and last status kept by UPDATE on a log table (§3.1).
sweep: `grep -n "attempts\|last_status" docs/rss/scaffold/supabase/migrations/0279_rss_p9_webhooks.sql` → the two
mutable columns; 0286 replaces them with webhook_attempts rows under no-update rules.
severity: medium

### F3 - a login error shown from the URL would let anyone put words on the sign-in page
class: displaying a query-string message verbatim on an auth page.
sweep: `grep -rn "searchParams?.get(\"error\")" src/app` → the login page only; it now shows oauthErrorMessage(code)
from a fixed list.
severity: medium

### F4 - the single-email account lookup stops silently on a listing error
class: an error read as "no account" (pre-existing in findAuthUserByEmail: `if (error || !data) break`).
sweep: `grep -n "if (error || !data) break" src/lib/supabase/admin.ts` → 1 hit (the existing helper); the import uses
the new findAuthUsersByEmails, which throws.
severity: low

## Addendum 2026-11-20 — residuals closed after the phase

- R4 (DNS): sendSigned now resolves the host before every send and refuses ANY private answer (resolvesPrivate);
  webhooks.test.ts covers a name resolving to 169.254.169.254 (the address is never called) and an unresolvable name.
- RLS as signed-in users: scripts/sql-harness.mjs CLAIM 4 reads audit_log, erasure_requests, webhook_endpoints,
  company_recording_settings, recording_trims, training_assignments and the trimmed transcript as a CEO, a manager, their
  report, a rep outside the tree and another company's admin. Its own code, extracted and run on PGlite 16.4:

```
CLAIM 4 PASSED (harness code, executed on PG 16.4)
mutant (rss_audit_select using (true)):
CLAIM 4 FAILED: audit_log as MGR: saw 1, expected 0; audit_log as REP: saw 1, expected 0; ...
exit 0
```

  Found while writing it: rss_tree_active (0273) keeps the reporting tree OFF while any 'staff' profile has no manager
  — a CEO marked as a Sales Coach rep with no manager keeps every manager on company-wide view. That is 0273's stated
  stand-in, recorded here because the Team page should make it visible (OPEN.md).

## Addendum 2026-11-20 — the tree-off notice (migration 0287)

rss_tree_blockers is the one rule; rss_tree_active is redefined on it, so the Team page's list and the policies'
verdict cannot drift. Executed on PGlite 16.4:

```
CEO marked staff, no manager: {"active":false,"blockers":["2a1"]}
CEO not a rep:                {"active":true,"blockers":[]}
rep loses manager:            {"active":false,"blockers":["2a3"]}
exit 0
```

## Addendum 2026-11-20 — managers carried on invitations (migration 0288)

Through the real accept_invitation (0114), signed in as each invitee, PGlite 16.4:

```
admin's invite, manager on team  : {"joined":true,"manager":"a3"}
member's invite (not applied)    : {"joined":true,"manager":null}
manager since removed (skipped)  : {"joined":true,"manager":null}
exit 0
```

Only an admin's invitation applies the manager (a member could otherwise pre-assign a newcomer to a manager of their
choosing); joining never fails because of it.

## Addendum 2026-11-20 — the admin-role list (0290, 0291, INVARIANT 39)

OPEN.md's rss-p0 item assumed is_sales_coach_manager() treated CFO as a manager. It did not: 0252's literal
('CEO','COO','admin') predates CFO, and 0265 (founder ruling: one list) rewrote policies, not functions. INVARIANT 39
(latest definition of every SQL function and policy, replayed) found 10 copies; 0290/0291 replace only the literal.
Signed-in on PGlite 16.4 after the change:

```
CFO          {"scm":true,"fin":"cfo","vendor":false}
Member       {"scm":false,"fin":null,"vendor":false}
removed CEO  {"scm":false,"fin":"cfo","vendor":false}     ← pre-existing status gap, OPEN.md
CFO invites a COO     : {"role":"COO"}
Member invites a CFO  : ERR new row violates row-level security policy for table "team_invitations"
Member invites a Lead : {"role":"Lead"}
applied 289/289; re-applied 21/21
exit 0
```

## Addendum 2026-11-20 — removed people (0292)

```
CFO          {"scm":true,"fin":"cfo","vendor":false}
Member       {"scm":false,"fin":null,"vendor":false}
removed CEO  {"scm":false,"fin":null,"vendor":false}     ← was "cfo" before 0292
applied 290/290; re-applied 22/22; invariant Violations 0
exit 0
```

## Addendum 2026-11-20 — one clean canonical run over everything since Phase 7

Two earlier full runs timed out on a machine at load average 58-94 (another project's dev server, iCloud sync):
every static step passed and no test failed an assertion; the 13 and 16 files that timed out each passed when rerun
on their own. That was composite evidence, so the canonical command was run again unchanged at lower load:

```
npm run check exit 0
 Test Files  794 passed | 1 skipped (795)
      Tests  6062 passed | 15 skipped (6077)
   Duration  44.22s
```

Covers 0271-0294, streams/STT metering, live end times, comment mentions, the admin-role list (INVARIANT 39),
removed-people helpers, and docs/rss/APPLY-RUNBOOK.md (every SQL check in it executed on the PG 16 replay).

## Addendum 2026-11-20 — outside-view security review (erasure, webhooks, trims)

A fresh reviewer read 0284-0286 and their routes with no conclusions handed to it. Findings and disposition:

| # | Finding | Severity | Disposition |
|---|---|---|---|
| 1 | Webhook URL check bypassed by IPv4-mapped IPv6 (`[::ffff:7f00:1]`), `[::]`, `localhost.`, NAT64, fe90-febf, 4 reserved IPv4 ranges | high | FIXED (normHost; every `::`-prefixed v6 refused; ranges added). Also found independently by probing before the report arrived. webhooks.test.ts pins all forms |
| 2 | DNS rebinding: checked once, fetch re-resolves | medium-high | FIXED: pinnedPost connects via node:https with a lookup that refuses private answers at connect time — no second resolution. Test: pre-check fooled "public", connect-time lookup of localhost refused |
| 3 | Trimmed lines readable from the base transcript table (all versions) | medium | FIXED in 0295: the base read policy carries the trim predicate. The audio file is kept whole BY DESIGN (F9.17: restorable); erasure (0285) is what removes audio |
| 4 | rss_line_trimmed probeable across companies | low-medium | FIXED in 0295: answers false outside the caller's company; unchanged for the service role |
| 5 | A failed erasure leaves an erasure_requests row with no completion; a retry adds another | low | OPEN (OPEN.md): no data lost; the record reads as abandoned requests |
| 6 | Overlapping cron runs can send one delivery twice | low | OPEN (OPEN.md): attempts are de-duplicated; receivers de-duplicate on the delivery `id`, which is the documented contract |
| 7 | Malformed restoreTrimId → 500 | low | FIXED: 400 before any query; test added |
| — | "signals.source exists?" | — | Yes (schema listing; the erasure replay updated it) |

Signed-in on PGlite 16.4 after 0295:

```
rep, BASE table, all versions: ["1:keep","2:keep"]
rep, _current view: ["keep"]
other company probes the trim: [{"t":false}]
service role (no user) sees the trim: [{"t":true}]
exit 0
```

## Addendum 2026-11-20 — gate after the review fixes (0295, pinned webhook sends, URL normalisation)

```
npm run check exit 1        (load average 15-18; another session's `npm run dev` in this repo + iCloud sync)
  every static step passed; invariant Violations: 0
  Test Files 785 passed | 1 skipped; 0 failed; 9 errors — all "Timeout waiting for worker to respond"
each of the 11 files named in those errors, run alone:  1 passed (1)  ×11
```

Composite evidence, not one clean run: nothing failed an assertion; the exit code is the worker-start timeouts.
The last clean canonical run (exit 0, 794 files / 6062 tests) predates these fixes; re-run `npm run check` on a
quiet machine before committing.

## Addendum 2026-11-20 — clean canonical run over the review fixes

```
npm run check exit 0
 Test Files  794 passed | 1 skipped (795)
      Tests  6065 passed | 15 skipped (6080)
   Duration  80.45s
```

Supersedes the composite evidence above: everything through 0295, the pinned webhook sender, URL normalisation and
the trim-id validation passes the canonical gate in one run.

## Addendum 2026-11-21 — second outside-view security review, and its disposition (migration 0296)

The reviewer read the diff cold; it edited nothing. Findings, most severe first:

| # | Finding | Severity | Disposition |
|---|---|---|---|
| 1 | A non-admin could set someone's manager through 0288: `invited_by` was not checked on insert, `manager_id` was mutable, any member may write `accepted_at/by` (0008:100), and the definer trigger trusted both | HIGH | FIXED in 0296, three independent closes: the trigger acts only when `accepted_by = auth.uid()`, that user's auth email matches the invitation, the inviter is an active admin and the manager is active; `manager_id` added to the immutability trigger; insert policy requires `invited_by = auth.uid()` |
| 2 | A `named` comment could be saved while its mentions failed (two inserts, no transaction) → readable by the author only, yet "Sent to the rep" | MEDIUM | FIXED: `rss_insert_comment` (service role only) writes comment + mentions in one transaction; the route uses it whenever visibility ≠ everyone or there are mentions; route test asserts the RPC arguments and no loose inserts |
| 3 | The CSV import looked each invite's email up again (a full `auth.users` listing per row) and could pass `maxDuration` halfway | MEDIUM (operational) | FIXED: the import passes the accounts it already found (`knownAccountIds`); `createInvitation.test.ts` pins that no lookup runs and an existing member is still refused |
| 4 | `rss_comment_base_visible` answered for any viewer | LOW | FIXED in 0296: `auth.uid() is null or viewer = auth.uid()`, the same guard as `rss_can_view_rep` |
| 5 | Retention's "table missing" regex also matched a missing COLUMN → the purge would fall back to 20 | LOW | FIXED: only a missing table (PGRST205/42P01 or the table-not-found messages) falls back; `retention.test.ts` pins PGRST204 / 42703 / other errors as errors. The 42703 case matched the old regex, so the test discriminates |
| 5b | (unconfirmed) Purge candidates paged by `created_at` alone could repeat a row at a page boundary | LOW | FIXED: `id` tie-break added to the order; purge-cron fakes now chain `.order().order()` |

Signed-in on PGlite 16.4 after 0296 (attack script, each a separate signed-in member):

```
A forge inviter=admin      : REFUSED: new row violates row-level security policy for table "team_invitations"
B edit manager_id on admin's invite: REFUSED: team_invitations.manager_id is immutable
C mark admin's invite accepted by victim: OK            ← the row update is allowed (0008, pre-existing) …
   victim's manager after C: null                       ← … but nobody's manager changes
D legit: new@t.com accepts admin's invite: OK [{"ok":true}]
   newbie's manager after D: a3
E member's own invite (invited_by = self) still allowed: OK
F comment visibility probe for someone else: OK [{"v":false}]
```

C is recorded in docs/residuals/OPEN.md: any member can still mark an invitation accepted (0008's update policy).
It no longer moves anyone, but the invitation then reads as accepted.

Affected tests after the fixes: comment route, purge cron, import, retention, createInvitation — all pass.

## Addendum 2026-11-21 — canonical gate over 0296, and 0297 (the C residual)

```
npm run check exit 0
  Violations: 0
 Test Files  795 passed | 1 skipped (796)
      Tests  6070 passed | 15 skipped (6085)
```

0297 closes path C above. Narrowing 0008's update policy to admins was rejected: revocation runs on the caller's client
(PATCH /api/team, and createInvitation's auto-revoke of an expired invite, which a non-admin inviting a Member reaches).
The defect is the accepted_* columns, so the guard sits on them: `check_invitation_immutability` (security invoker)
refuses an accepted_* change when current_user is authenticated/anon; accept_invitation (0114, definer) is unaffected.

Signed-in on PGlite 16.4 through 0297 (0296+ applied twice — idempotent):

```
C mark admin's invite accepted by victim: REFUSED: team_invitations: an invitation is accepted only through accept_invitation
D legit: new@t.com accepts admin's invite: OK [{"ok":true}]   newbie's manager after D: a3
G member revokes the admin's pending invite (revocation unchanged): OK [{"ok":true}]
H member sets accepted_by alone on a pending invite: REFUSED: team_invitations: an invitation is accepted only through accept_invitation
(A, B, E, F unchanged from the 0296 run)
```

## Addendum 2026-11-21 — release: 0271–0297 applied to production; the live gate failed once; 0298

Founder chose "Apply DB, then push". `npm run db:verify` (27 pending, all clean, rolled back) → `npm run db:apply`:
migrations applied, then verify:live **1 of 30 FAILED** — "tenant isolation BEHAVIORAL: ROLE anon reads 0 …
permission denied for function rss_tree_allows". Code push held.

Diagnosis (read-only sweep of all 188 RLS tables as anon on production, each in a rolled-back transaction): 24 tables
errored — 23 on rss_tree_allows (0273), recording_comments on rss_comment_base_visible; team_passwords on a table
grant (pre-existing, refuses). rubric_config returned 1 row: the shared default rubric (company_id null, 0252:232),
by design. Cause: policy helpers revoked from anon; Postgres need not evaluate the tenant test first, so an anonymous
read raised 42501 instead of returning no rows. No data leaked; signed-in users have the grant.

A catalog check on PGlite (every policy function anon cannot execute) found two more the sweep hid behind the first
error: rss_comment_mentions_me and rss_line_trimmed. 0298 grants anon all four, each answering "no" for anon:
rss_tree_allows requires auth.uid(); rss_comment_base_visible trusts a userless caller only with the service_role
claim (grants access → fails closed); rss_line_trimmed trusts every userless caller except anon (hides content →
fails toward hiding). Production's auth.role() read live: NULL with no claims, "service_role" under PostgREST claims.
The shim defaulted to 'anon'; it now matches production verbatim (0298 is the first migration to read auth.role()).

PGlite 16.4 through 0298 (0298 applied twice):

```
anon reads coaching_sessions / pitch_scores / recording_comments: 0 / 0 / 0   (no error)
anon RPC rss_tree_allows: false · anon comment probe: false · service role (route) checks admin: true
admin signed in reads comments: 1 · pitch_scores: 1 · rep rss_tree_allows(self): true · rep probes admin: false
policies applying to anon that call a function anon cannot execute: 0
trim replay: rep _current ["keep"] · other company probe false · service role (no user) sees the trim true
invite attack replay A–H: unchanged (C/H refused, D/G pass)
npm run sql:harness: SKIPPED (no local Postgres) — not a pass; the PGlite replays are the evidence
```

Production: `db:verify` 0298 clean → `db:apply` (first attempt: connection timeout, nothing applied; retry) →
"applied 1 migration(s). DB now at 0298" · "✓ PASS tenant isolation BEHAVIORAL … anon reads 0 from 5 populated
tenant tables" · "✓ verify:live passed".

## Addendum 2026-11-21 — A16 / A21 audit after the release commit

**A16 (AI surfaces on one call compose).** Ask Coach read only transcript lines and chat history — it could call an
objection "handled well" that the rep's scorecard marked missed. Now each call's stored Pitch Score goes in beside its
transcript via `readPitchScore(id, db)` (the caller's client; corrected grades — 0256 upserts the element grade; the
override log listed), with a prompt rule: do not silently contradict it; say so, naming the grade. A failed read is told
to the model as "could not be read", never "not scored". Follow-through: its suggested outcome is compared against
`session.outcome`, the same source `pitch_scores.outcome` derives from (scoreSession.ts:288), and is labelled a second
opinion — no contradiction. Practice-ask already passes the review summary.

**A21 (same concept across modules).** Ask Coach: one engine for the per-call route and the cross-call ask. Scoring:
NOT at parity. `scoreSession` had three callers — finalize (live calls), the Score button, the manual drain; nothing
scored an UPLOADED call (label-transcript → generateSessionArtifacts only; vercel.json registers no scoring cron). Every
remote call arrives by upload, so its chip sat on "Scoring" (stage.ts:37) — against 01-SCOPE.md:61 "Done means …
Uploading → Transcribing → Analysing → Scoring → Ready". Root cause: scoring was wired beside the shared
post-transcript path, into finalize only. Fix: label-transcript scores after generation exactly as finalize does (owner's
client, skipIfScored, verdict consumed); maxDuration 60 → 300 (finalize's; it claimed parity at 60).

Tests: askCoach.test.ts +4 (scorecard text, unscored vs unreadable, reaches the model on the caller's client, a failed
read still answers); label-transcript route.test.ts +4 (scores with the owner's client after generation; still scores
when generation fails; never on the 409 path; never without a company). 13 + 17 pass. Typecheck clean; invariant
Violations 0. Residuals: the pre-fix backlog (run the drain once after deploy); recovery / cron / attribute / trim paths
do not score (OPEN.md).


## Correction 2026-11-21 — the theme audit never saw the RSS UI before the release commit

`scripts/theme-audit.mjs:195` scans `git ls-files src` — tracked files only. Every `npm run check` before commit
e4eaafcd (including the "exit 0" in its message) ran the theme audit WITHOUT the ~100 untracked RSS files. Once they
were tracked, it found one: `RemoteCallPanel.tsx` playback-speed chip, `bg-ember-400` and `hover:text-primary` in one
className template. The two are opposite ternary branches (never on one element), so the classes were split into
SPEED_ON / SPEED_OFF rather than exempting the whole file. No other gate is tracked-only (grep of scripts/ for
ls-files: only the theme scripts). After the fix:

```
npm run check exit 0 · Theme-bound leaks: 0 · Violations: 0 · Test Files 795 passed | 1 skipped · Tests 6078 passed
```

## Addendum 2026-11-21 — invariant 16 blind spot; attribute-unlabelled had no time budget and did not score

INVARIANT 16 ("every route that awaits an LLM call exports maxDuration") matched a fixed list of wrapper names; its
own comment admitted "a new wrapper still needs adding". generateSessionArtifacts (five engines), scoreSession and the
RSS askCoach / runFollowThrough were in no list. Widened two ways: every async function src/lib/claude.ts exports is
read from the file (a new model function is covered when written — A13, category not word; the audit throws if it
reads none), plus the multi-call wrappers by name. First run of the widened rule:

```
src/app/api/coach/sales-session/[id]/attribute-unlabelled/route.ts — awaits an LLM call, no maxDuration
Violations: 1
```

That route runs the five engines in after() on Vercel's short default. Fixed: maxDuration = 300 (finalize's), and it
now scores after regenerating (owner's client, skipIfScored, verdict consumed) — the answer is what makes the call
scoreable. Tests +2 (scores after generation on the caller's client; still scores if generation fails; never on a
customer-only answer; never on a failed write): 27 pass. Invariant Violations: 0 after.


## Addendum 2026-11-21 — sql-harness CLAIM 5, and residuals closed on production evidence

CLAIM 5 (scripts/sql-harness.mjs): a rep cannot set their own manager_id, the privileged writer can; a member cannot
write accepted_* on an invitation, revoking still works (0297); anon reads coaching_sessions / pitch_scores /
recording_comments / coaching_transcript_segments as 0 rows, no error (0298). The harness skips here (no local
Postgres), so the claim's exact text was run on PGlite 16.4 through a pg-compatible adapter:

```
✓ manager_id is not self-settable; invitations accept only via accept_invitation; anon reads 0, no error
MUTANT profiles triggers off        → ✗ a rep moved themselves under another manager (manager_id not guarded)
MUTANT team_invitations triggers off → ✗ a member marked an invitation accepted directly (0297)
MUTANT anon revoked on rss_tree_allows → ✗ coaching_sessions: permission denied for function rss_tree_allows; …
```

Closed in OPEN.md: rss-p0 manager_id SQL test; rss-p0 re-score audit row (route.ts:208-217, Phase 8); rss-p0 re-score
503 (production has pitch_score_archive — read-only check, ledger 0298); rss-p7 migrations applied.

## Addendum 2026-11-21 — unfinished erasures are shown (review finding #5)

The erase route records the request first, then removes audio, then rss_erase_sessions records the completion; a
failure between leaves a request with no completion, and only a hash is stored, so it cannot be re-run alone.
GET /api/coach/remote/erasure (admins) returns the unfinished ones via `unfinishedRequests` (erasure.ts): no
completion; not finished by a LATER completed request with the same match_hash (a retry); older than 6 minutes (the
route's maxDuration is 300s, so nothing younger can be a failure). A failed completion read is a 500, never "none
finished". ErasurePanel shows them (amber notice, the file family's attention style) and reloads after every erase.
The copy "calls already erased simply won't be found" was checked against 0285: the search reads client_label and
transcript lines (0285:116-149); the erase deletes every transcript version and nulls client_label (0285:200, 219-220).
Tests: route.test.ts +9 (rule: unfinished / completed / finished-by-retry / earlier completion does not excuse a later
failure / grace / no hash; GET: admins only, lists with asker, completion-read failure → 500).

## Addendum 2026-11-21 — unreferenced recordings removed; nightly sweeper; INVARIANT 40

Full record: docs/STORAGE-ORPHANS-2026-11-21.md. Founder picker: delete + nightly sweeper. Production: 0299 applied
(verify:live passed); dry run 466 files / 405.7 MB = the measured set; applied — 466 removed, Storage-confirmed, 7 audit
rows; storage 1.196 → 0.77 GB; live pointers intact (sessions 21/21, pitches 103/103, files 55/55).

```
npm run check exit 0 · Theme-bound leaks: 0 · Violations: 0 · Test Files 797 passed | 1 skipped · Tests 6100 passed
```

## Addendum 2026-11-21 — "Remote Sales" in the feature list (founder request)

Founder, with a screenshot of the live sidebar (PRODUCTION: Command Center … Company Brain; footer "Constitution v1.13"
— the live build predates this work): "please add the new module to this list of our current feature".

The plan's UI spec places every RSS screen inside Sales Coach and gives the module no entry of its own; this adds one at
the founder's request. Sidebar: "Remote Sales" (PhoneCall icon) right after Sales Coach, opening
`/dashboard/sales-coach/sessions?context=remote`, with a hint that names only what ships today. Command palette: the
same entry (keywords remote/phone/video/call/recording/upload/transcript/score). List API: `context=remote` filters
`.in("context", REMOTE_CONTEXTS)` — the one definition (sessionContext.ts:14) the session page already uses; any other
value is still the honest no-op. Sessions page: reads `?context=` on mount (window.location — useSearchParams would need
a Suspense boundary) and offers "Remote (phone + video)". Highlighting is an exact pathname match (Sidebar.tsx:807), so
like Sales Coach's other sub-pages the entry does not highlight; no change to that rule.

```
npm run check exit 0 · Theme-bound leaks: 0 · Violations: 0 · Test Files 797 passed | 1 skipped · Tests 6100 passed
(the American-spelling test caught "analysed" in the hint first; fixed to "analyzed")
```

Follow-up: the Remote Sales link is inside /dashboard/sales-coach, so the 0207 module lock (moduleForPath, subtree-based)
and the Sales Coach layout's membership gate apply to it exactly as to Sales Coach — a care-only account is redirected to
C.A.R.E. Pinned in moduleAccess.test.ts (20 pass); the test fails if the entry ever leaves the subtree.

## Addendum 2026-11-21 — 0300: a late live recorder can no longer misplace a trim

Measured on production (read-only): uploads are exact (label-transcript sets spoken_at = started_at + file offset).
Live sessions put spoken_at on the BROWSER clock and started_at on the server's; chunk 0 landed 17.5–18.7 s after
started_at on 6/7 live sessions (on time) and 74.1 s on one (~56 s late). Every reader that turns spoken_at into an
audio position — rss_line_trimmed, loadLines (Ask Coach, follow-through), trackerScan, interactionStats, the session
page's transcript seek — now uses audioBaseIso(started_at, audio_started_at) / its SQL twin coalesce(...).
audio_started_at is the recorder start on the browser clock, sent with chunk 0 (useLiveCoaching), stored once by the
audio-chunk route (service role, company-scoped, within an hour of started_at); 0300 refuses a direct write by the rep,
who could otherwise slide the clock to un-hide a manager's trim. PGlite 16.4:

```
LIVE before audio_started_at (trim 0:02–0:06 vs line at 60 s on started_at): ["my card is 4111","thanks"]
rep sets audio_started_at directly: REFUSED: coaching_sessions.audio_started_at is set by the recording upload only
LIVE after audio_started_at = start + 56 s (line is 4 s into the audio): ["thanks"]
second change by service role: coaching_sessions.audio_started_at cannot change once set
OLD (no audio_started_at) still uses started_at — trim 58–62 s hides the 60 s line: []
npm run check exit 0 · Violations: 0 · Tests 6109 passed
production: db:verify clean → db:apply "DB now at 0300" → verify:live passed
```
Found on the way and logged, not changed: pitch-score evidence times are measured from the first line, not the
recording's start (OPEN.md).

## Addendum 2026-11-21 — scorecard evidence times are positions in the audio

The scoring prompt told the model "Timestamps are [m:ss] from the start of the recording" while measuring them from the
first line spoken; PitchDetail's play button seeks the audio to timestampS (PitchDetail.tsx:86), so every evidence link
was off by the silence before the first word. buildPitchScoreUserMessage now takes audioBase =
audioBaseIso(started_at, audio_started_at) from scoreSession — the base the transcript, trims and stats use (0300);
first line only with no start time. Tests +3 (8 s first word → [0:08]; a pre-audio line clamps to 0:00; no base keeps
the old behaviour); 279 scoring tests pass. Scores made before the deploy keep their first-line base.

## Addendum 2026-11-21 — production build before the push

`npm run check` does not include `next build`, which is what Vercel runs. Run locally at HEAD (15 unpushed commits):
`npm run build exit 0`; the new routes compile (/api/coach/sales-session/unreferenced-upload-sweep-cron,
/api/coach/remote/erasure, /api/coach/sales-session/[id]/audio-chunk, /dashboard/sales-coach/sessions). One warning,
pre-existing and non-blocking: Next.js's "middleware" file convention is deprecated in favour of "proxy".
Deploy limits: vercel.json crons 12 (origin/main) → 14 (HEAD: the webhook sender every 5 min, the nightly unreferenced-
upload sweeper). Production already deploys 12 including a per-minute cron, which only Pro allows (cap 40), so 14 fits.
New env vars all fail safe when unset (NEXT_PUBLIC_AUTH_PROVIDERS, RSS_WEBHOOK_SIGNING_SECRET, the two quota vars — the
last reads 0.77 GB as 77% of the Free plan; OPEN.md).

## Addendum 2026-11-21 — Remote Sales' first screen is not a dead end (§1.5.1 layer 3)

Production has no real remote call yet, so the first click on Remote Sales lands on an empty list. The filter is
server-side, so `sessions` came back empty and the page said "No sessions yet. Start one from Home." — false for anyone
with in-person history, and silent about the active filter. Now: remote → "No phone or video calls yet. Start one above
(Expert; StartSessionPanel is on this page) / from Home (Standard) — choose Online video or Phone — then record it live or
upload the recording on its page"; any other active filter → "No sessions match these filters"; no filter → unchanged.
npm run check exit 0.

## Addendum 2026-11-21 — INVARIANT 41: the 0298 class is caught before a migration ships

Replays every policy (as last defined) and every function's latest revoke/grant from the migrations; a policy that
applies to anon (no `to` clause, or public/anon) may not call a function anon cannot execute. HEAD: 0 violations.
Mutation: 0298 moved aside → 23 violations (22 × rss_tree_allows, 1 × rss_comment_base_visible) — the failure production
hit on apply; rss_line_trimmed is not flagged because 0300 re-grants it. Restored → 0. Pinned in invariant-audit.test.ts.
npm run check exit 0.

## Addendum 2026-11-21 — the theme audit now sees uncommitted files

Closes the blind spot recorded in "Correction" above: theme-audit.mjs listed files with `git ls-files src` (tracked
only). Now `git ls-files --cached --others --exclude-standard src` (plus an existsSync filter for working-tree
deletions); the two hand-listed untracked chat pages it had patched in are covered generically. Mutation: an untracked
src/components/zz-theme-mutant.tsx with `bg-ember-400 text-primary` → "Theme-bound leaks: 1" naming it; removed → clean.
npm run check exit 0.

## Addendum 2026-11-21 — the SQL shim is checked against production on every db:apply

After auth.role(), auth.jwt() ('{}' vs NULL) and auth.uid() (ignored request.jwt.claims) were also found to differ from
production; both now carry production's bodies verbatim. verify:live gains "the SQL shim's auth.uid / auth.jwt /
auth.role are production's" (compares pg_proc.prosrc with the shim, whitespace-insensitive): PASS against production;
mutant (auth.jwt back to '{}') → FAIL naming auth.jwt; restored byte-identical. Every PGlite replay from today re-run on
the corrected shim with unchanged results (anon, attack A–H, CLAIM 5, trims, 0300 audio start, 0299 rule).
npm run check exit 0.

## Correction 2026-11-21 — the SQL harness did not run in CI; now it does

Earlier addenda (CLAIM 5; the residual closures citing it) said the harness "keeps it as a gate on real Postgres" in CI.
It did not: .github/workflows/ci.yml ran migration:audit against its Postgres service but never sql:harness (nor
writer:audit / enum:audit), while its header said it mirrored `npm run check`. Locally the harness skips without
Postgres, so its claims ran nowhere. Fixed: ci.yml now runs writer:audit, enum:audit and sql:harness (same Postgres
service and credentials as migration:audit); `tbc` stays on the commit hooks (needs full history), stated in the header.
Before enabling, all 5 claims were run from the harness's own text on PGlite 16.4 through a pg-compatible adapter:
5 of 5 pass. The no-secrets CI build (`npm run build:ci`) passes. The harness's SKIPPED list now names CLAIM 5.

## Addendum 2026-11-22 — gate evidence for bdf02b8a (CI gains sql:harness / writer / enum audits)

bdf02b8a was committed before its gate finished (the commit was chained with `;` — a process slip, now a memory rule:
commit only after a green check). Its gate, run twice under heavy load from iCloud Drive's sync (`bird` at ~100% CPU;
the repo is on the synced Desktop):

```
run 1 (load ~69):  npm run check exit 1 — 6 failed (spawn-heavy scripts/__tests__ timeouts)
                   scripts/__tests__ alone: 136 passed (136)
run 2 (load 123):  npm run check exit 1 — 2 failed, both timeouts ("pass a timeout value"; "Timeout waiting for worker")
                   MeetingReview.render.test.tsx + homeDesktopStatsError.render.test.tsx alone: 3 passed (3)
static gates both runs: Violations: 0
```

Composite evidence, not one clean run: the failing files differ run to run, every one passes alone, and bdf02b8a touches
no code those tests import (ci.yml, the harness's skip message, docs). The last single clean run of the full gate was
at 4f2c3cb8 + 8aea6588 + 158eac2e (exit 0, 6113 tests). Re-run `npm run check` on a quiet machine before relying on it.

Third run, two test workers to cut contention (load 19–60 during; 2088 s against ~60 s on a quiet machine):
`Test Files 2 failed | 794 passed | 1 skipped · Tests 2 failed | 6102 passed` — both "Test timed out in 20000ms"
(writer-audit.test.ts, ScoringRubricSheet.render.test.tsx) plus one worker that failed to start (meeting-prep document
route). The three files alone: `3 passed · 41 passed`. Three runs, three different sets of failing files, every
failure a timeout, every failing file green alone — no assertion has failed. A single clean run still needs a quiet
machine (iCloud's `bird` stays at ~100% CPU while the Desktop-hosted repo syncs).

## Addendum 2026-11-22 — pushed, deployed, CI green

Pushed 24 commits (0214913c → 3a49f7ee) through VS Code's own Git: Push (the founder's sign-in; this shell has no
GitHub credentials). elostate.com reported build.commit 3a49f7ee 80 s later. Live: /dashboard/sales-coach/sessions
?context=remote → 307 to sign-in (expected when signed out); unreferenced-upload-sweep-cron → 401 (CRON_SECRET set);
/api/health status "degraded" = file storage 71.8% of the assumed Free plan (quotaSource default-free-plan; OPEN.md).
Re-read 2026-11-22 for the record (A38), `curl -s https://api.github.com/repos/thethreethreethree/TeamPilot/commits/3a49f7ee/check-runs`

```
check completed success
build completed success
deploy completed success
report-build-status completed success
exit=0
```
GitHub CI for 3a49f7ee: job "check" completed **success**, every step green — Typecheck, Lint, RLS, Theme, Invariant,
Reachability, Writer audit, Enum audit, Migration apply audit, SQL harness, Test, Build, KB bundling. This is the clean
single run the loaded Mac could not give. One limit: the job log needs a GitHub sign-in (API 403 here), so that the
harness EXECUTED its claims rather than skipping is inferred — same Postgres service and credentials as the migration
audit, which passed by applying every migration. Confirm by opening the job → "SQL harness" → five ✓ lines.
https://github.com/thethreethreethree/TeamPilot/actions/runs/44948341093/job/136980521437

## Addendum 2026-11-22 — Remote Sales gets its own home (founder: "this does not reflect the system")

The founder, with a screenshot of the live sidebar after the deploy: the Remote Sales entry opened the old Sales Coach
sessions list, so nothing of the new system was visible; "do not model the new system based on what already exists, do
it based on our build plan". Reviewed the two linked plans: the Gong-vs-ELOSTATE comparison (346 features) and "Gong vs
ELOSTATE: what it takes to match" (Tech 1–6 + build order). docs/ELOSTATE-REMOTE-SALES-BUILD-PLAN is byte-identical to
docs/rss on SCOPE / ROUTES / UI-SPEC / BUILD-ORDER — the plan that was built. Audit of what a person can reach: every
plan API has a screen, but spread over six Sales Coach pages (session page; Coach Assessment; Search; Library; Settings;
Role-play), and the manager training screen was mounted nowhere (D18).

Built: /dashboard/remote-sales — its own layout (the Sales Coach access decision: membership + 0207 lock; REMOTE_SALES_
ROOT classified sales_coach) and shell ("Remote Sales", the plan's sections as tabs): Calls (start a phone/video call;
every remote call with live stage chips, length via conversationDurationSeconds, outcome, rep for managers), Coaching
(inbox + metrics), Search (transcripts, filters, saved searches, CSV export), Library (folders, clips, team examples),
Trackers, Training (Assigned to you; managers' scenario builder — mounted for the first time; placement only, D18's
content question untouched; reachability exception removed), Protection (retention, erasure, audit log, webhooks; admins).
Reps don't see Coaching/Trackers; Protection is admin-only. Sidebar and command palette open the home.

typecheck clean · lint clean · Theme-bound leaks 0 · reachability clean · invariant Violations 0 · moduleAccess 20/20 ·
build:ci PASSED (all 7 routes).

## Addendum 2026-11-22 — call downloads (Phase 5 R2 residual, F9.15)

GET /api/coach/remote/[id]/download?kind=audio|transcript, as 05-ROUTES specifies: managers only
(requireSalesCoachManager), the call opened with the caller's client, same company, treeAllowsRep — the trim route's
gate. Transcript = the current version from the _current view (trimmed lines already hidden), timed from audioBaseIso.
Audio = a 120 s signed link, REFUSED (409, reason in words) while any trim is active: the file still holds the trimmed
words, and a download would hand out what a manager trimmed for privacy. Every download → audit_log "session.download"
(new action; Settings → Protection labels it "Downloaded a call"). Panel: "Download transcript" / "Download audio" for
managers, a refusal shown in place. Tests: 6 (managers only; other company / outside tree 404; transcript text, timing,
audit; audio refused with an active trim; allowed once every trim is restored; bad kind 400). Also fixes "analysed" →
"analyzed" in the Remote Sales home (caught by the spelling test).

## Addendum 2026-11-22 — the missing search filters (Phase 5 R2 residual, F12.1 / F15.18)

runCallSearch gains: rubric element + grade (pitch_score_elements → pitch_scores.session_id, caller's RLS), the rep's
talk share (session_interaction_stats.talk_ratio_time, newest transcript version; a call with no measured share
cannot satisfy it), and disputed (coach.pitch_score_disputed events name the call). Parse validates the element against
ELEMENTS_BY_ID, grade ∈ hit/partial/missed (default missed), talk 0–100. The Search screen gets a rubric-item + grade
pair, talk-% bounds and a disputed checkbox. Found on the way and fixed: search hit offsets were measured from
started_at, the one reader the 0300 sweep missed — now audioBaseIso. Tests +7 (12 pass).

## Addendum 2026-11-22 — sales calls in the app-wide search (F12.4; closes the Phase 5 R2 residual)

/api/search (the Search page) gains salesCalls through runCallSearch — the same function as Remote Sales → Search, so
RLS, the reporting tree, sales-calls-only and trims are decided once. Each call shows its label, channel, rep, date and
up to two matching lines; a failed call search sets salesCallsFailed and the page says so ("the other results are
complete") instead of reading as no calls. Tests: 3 (included with two hits; failure flagged; empty query → empty shape,
no call search). Phase 5's R2 residual is closed in OPEN.md (filters, downloads, global search).

## Addendum 2026-11-22 — Remote Sales completely separate from Sales Coach (founder picker: Remote Sales owns video)

Founder: "make sure that the remote sales coach is completely separate from the previous sales coach system"; picker →
"Remote Sales owns video": Remote Sales = every phone and video call; Sales Coach = in-person only.
- Call page: the session page body moved (git mv) to components/sessions/SessionDetailView with `module`; rendered at
  /dashboard/remote-sales/calls/[id] (Remote Sales) and /dashboard/sales-coach/[id] (Sales Coach). A call opened in the
  other module's page is replaced to its own, keeping the query (?t= jump-to-moment). The After-Pitch door debrief and
  its redirects are Sales Coach only; naming a remote call reloads the call page. Back link per module.
- Start: StartSessionPanel({module}) — Remote Sales: Online video / Phone, opens the call in Remote Sales; Sales Coach:
  in-person only. The Sales Coach home's own start controls (mobile + desktop) are in-person only, with a pointer to
  Remote Sales.
- Lists: Sales Coach sessions list requests context=in_person (filter control removed); Remote Sales Calls lists phone
  + video and links to its own call page.
- Screens moved out of Sales Coach: Search and Library pages git-mv'd to /dashboard/remote-sales/* (old addresses
  redirect); coaching inbox removed from Coach Assessment; trackers and the Protection tab removed from Sales Coach
  settings; Sales Coach links to search/library removed. Remote Sales search and its CSV export are remoteOnly (phone +
  video); the app-wide search still finds every call and opens each in its own module.
Data stays in the shared tables (picker: not "separate data"). typecheck · lint · theme 0 · reachability · invariants 0
· 101 test files / 789 tests · build:ci PASSED.
Follow-up: the last links from Remote Sales screens into Sales Coach — the coaching inbox now opens calls in Remote
Sales; assigned practice opens /dashboard/remote-sales/practice (the role-play screen inside Remote Sales; the Training
tab stays active), and the assignment list is off the Sales Coach role-play page. The Protection audit log links any
session to Sales Coach's address, and the module router sends a remote call on to Remote Sales. 54 test files pass.

## Addendum 2026-11-22 — separate numbers: Sales Coach counts in-person; Remote Sales has its own scoreboard

Founder picker: "Own scoreboard in Remote". Audit found ~25 Sales Coach aggregations with no channel filter (dashboard,
KPIs + KPI cron, points, leaderboard/breakdown/milestones/team assessment via readPitchPeriod, Recordings tab, rep and
team activity, team analytics, weekly digest, Elo, why-patterns, best pitch).
- 0301: views pitch_scores_by_channel / agent_point_ledger_by_channel (security_invoker; channel =
  coalesce(session.context, 'in_person')) — views, not a column, because agent_point_ledger refuses UPDATE (0242) and
  could not be backfilled. Applied to production (verify:live passed); views see every row (scores 52/52 in_person;
  points 152 = 149 in_person + 3 video — three old video test-session rows now leave Sales Coach totals).
- TS twin contextsOf(module) (sessionContext.ts). readPitchPeriod takes `module` (default sales_coach); 23 Sales Coach
  reads scoped to in_person (sessions by context; scores and points through the views by channel).
- Remote Sales → Scoreboard: MyProgress + PitchLeaderboard with module=remote_sales (my-points and leaderboard take
  ?module=remote_sales; anything else is Sales Coach). Same rule as Sales Coach's board: managers see the ranking, reps
  their own standing.
- Found on the way: INVARIANT 29 delimits a statement at `;`, and the first comment text "(0301; founder …)" ended six
  statements before their company_id filter — the queries were tenant-scoped; the comment now uses a comma.
Tests: readPitchPeriod +2 (default in_person; remote = video+phone), best pitch +1, leaderboard +2; fakes updated for the
channel scope. 394 test files / 3471 tests pass · Violations 0 · RLS audit (views invoker) · theme 0 · build:ci PASSED.

## Addendum 2026-11-22 — both sides of a remote live call (founder: "the audio needs to be recorded and monitored for both the agent and the prospect")

**Understanding (from the record).** The Start panel said it plainly: on video/phone "your mic hears your side — not the
prospect's audio from the far end". useLiveCoaching.ts opened one getUserMedia mic, recorded it, and fed one Scribe
socket; composeProvisional forced every turn to "agent" (source video-mic) because the prospect is never in the mic.
So a live remote call saved and transcribed one voice. Uploads were unaffected (the file has both voices).

**Build.** The only browser route to another tab's audio is getDisplayMedia with "Share tab audio".
- `src/lib/coach/v5/callAudio.ts` (new): requestCallAudio (asked FIRST at Start, inside the click's activation, before
  the mic prompt), CallAudioTranscriber (the shared track → its own AudioContext → its own Scribe socket, bounded
  reconnect, "lost" when the share ends), prospectTurn (speaker customer, source call-audio), callAudioNote (every
  no-capture case named to the rep: unsupported / declined / shared without audio / lost).
- `useLiveCoaching.ts`: mic + call tab mixed into ONE recording track (MediaStreamDestination) so the saved audio holds
  both voices; the prospect socket appends final "customer" turns and starts the cue clock on them; the mic socket is
  unchanged (still the rep). Talk-share confidence counts the prospect when the call audio is live.
- 0302 widens 0236's CHECK by 'call-audio'; ATTRIBUTION_SOURCES gains it; the drift test now reads 0302.
- LiveCoachingPanel: on a remote call, "Record and transcribe the prospect too" (on by default) with the one instruction
  for the picker; the prospect's live words show under the rep's. StartSessionPanel's disclosure updated.

**Ripple.** 0302 must be live BEFORE this code: finalize/segments accept 'call-audio' (zod from the array) and the old
CHECK would reject the insert and lose the transcript — so the migration is applied first. Reconnect path never re-asks
for the share. recorderMimeDefault drift guard (no forced mimeType) still holds.

**Limits.** Desktop Chrome/Edge only; a call in a desktop app has no tab (Windows "Entire screen" can share system
audio). Not yet exercised on a real call — the founder's first remote live call with a shared tab is that check.

## Addendum 2026-11-22 — managers can comment on a Remote Sales call (found by the Gong re-grade, F9.8)

**Understanding (from the record).** The 22 Nov re-grade of the Gong ledger (five reviews against eab8523c) found that
comments with @mentions (0293/0296) are written only from Coach Assessment → Recordings, which lists in-person calls since
0301. Opening the code confirmed a second, worse half: `readPitchRecordingDetail` — the BY-ID read behind every comment
display — carried the same in-person filter (added in the separation commit), so a remote call's comments could not be
read back by the rep or the manager either. A rep's feedback request on a phone/video call (F16.1) lands in an inbox
that says the manager answers "on the call", where there was no box.

**Build.** `RemoteCallComments` on the Remote Sales call page: managers write at a time in the call, choose who can read
it, @mention; the rep sees what was sent to them; an unscored call says comments open once it is scored. It reuses the
one comment writer (pitch-recordings/comment) and the one reader (pitch-recordings?pitchId) — no second copy of who may
read (§2.2). The by-id read loses its channel filter; the Sales Coach LIST keeps it, and a test guards both.

**Ripple.** Sales Coach totals and lists unchanged (the list read still scopes to in-person). The by-id read is gated by
RLS (owner, or a manager in the tree), so dropping the channel filter widens nothing beyond what RLS already allows.

## Addendum 2026-11-22 — Remote Sales Macro Mode (the team's simplified system)

**Source.** The team's "General Sales Interface for Elostate" (3 pages, shared by the founder 2026-11-22) and the
founder's direction: "we need to create a macro mode that will have this simplified remote sales system — similar to what
we have done for the previous sales coach." Recorded as docs/rss/MACRO-MODE-SPEC.md, which maps each ask to what exists
and what is new.

**Understanding.** "Similar to Sales Coach" = Sales Coach's per-rep Macro Mode switch (0219, profiles.macro_mode_enabled,
MacroModeToggle) that focuses the module. Remote Sales gets its OWN column (the founder required the two modules separate).
Reused, not rebuilt: the call summary (Call Brief), the growth review (did well / improve, strengths-first tone law), the
pitch score (0–100), Tasks (to-dos and reminders), the reporting tree (manager sees reports' pipelines).
Found while building: a sales-only company is module-locked away from /dashboard/operations (the Tasks page) — so every
to-do is shown and ticked off inside Remote Sales, and "Done" walks the Tasks transition graph (To Do → In Progress →
Completed) through PATCH /api/tasks rather than writing a status.

**Build.**
- 0303: the switch; remote_call_briefs; remote_checklist_reviews; the pipeline as prospects + EVENTS (stage, amount,
  next call, name — current value = latest event, remote_prospects_current) + call links + to-do links; follow-up drafts;
  day plans (rep-only). All append-only; caller-client writes checked by insert policies.
- callBrief.ts (after-call pipeline, beside follow-through): key points / next steps / bring-up must cite a real line or
  are dropped; checklist due dates bounded. macroMode.ts: follow-up drafts refuse template slots; the day plan may only
  organise what the rep wrote; yesterday is counted, never written by a model.
- Routes: macro-mode, [id]/brief (+ /review), [id]/followup, prospects, prospects/[pid], day.
- Screens: the switch on Calls; Macro tabs Today · Pipeline · Calls; a finished call in Macro Mode = player + Highlights /
  Coaching / Next Meeting, with "Show the full call page" (never a one-way door).

**Verification.** Unit tests (macroMode.test.ts, 11) — one found a real bug: a missing score averaged as 0 (Number(null)),
fixed in summariseYesterday. SQL: the committed harness CLAIM 6 text, executed on PGlite 17 after replaying all 303
migrations:

```
migrations through 0303_remote_macro_mode.sql; failures: 0
✓ 0303 pipeline: latest-event state, append-only, tree visibility, private day plan, no foreign links
exit=0
```

**Not done / limits.** Salesforce/HubSpot push and calendar sync (the spec's later steps). The AI reads have not run on a
real call yet — the founder's first remote call after push is that check. 0303 must be applied before the code deploys
(the screens say "waiting on migration 0303" otherwise, they do not break).

## Addendum 2026-11-22 — Macro Mode's Coaching tab carries manager comments (workflow trace, §1.5.1 layer 3)

Traced the manager's path after Macro Mode shipped: a rep's feedback request → Coaching inbox → "the manager comments on
the call" → the call page. In Macro Mode that page shows the player and three tabs only, so the comment box added the
same day (6f6b2f76) was not on it: the manager would land with no way to answer. `RemoteCallComments` now sits in the
Coaching tab (a rep reads "From your manager" there; a manager writes there). MacroCallView render tests (4) cover the
tabs, the pipeline entry, the checklist sending only what the rep kept as edited, the comment in Coaching, and the
full-page escape hatch.

```
npx vitest run src/components/remote-sales → Test Files 2 passed (2), Tests 10 passed (10)
npm run check → Test Files 802 passed | 1 skipped (803), CHECK_EXIT=0
```
