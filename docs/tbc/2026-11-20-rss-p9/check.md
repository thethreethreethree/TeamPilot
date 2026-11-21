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
