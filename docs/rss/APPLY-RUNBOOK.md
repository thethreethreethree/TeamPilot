# RSS — apply and verify runbook (migrations 0271–0300)

Written 2026-11-20, when the Supabase project was suspended (storage quota) and none of these had been applied.
Every migration below has been replayed in order, twice, on PostgreSQL 16 (PGlite) with `scripts/sql/supabase-shim.sql`;
the build records are `docs/tbc/2026-11-15-rss-p0` … `docs/tbc/2026-11-20-rss-p9`.

## 0. Before anything

1. Restore the Supabase plan (the project returns 402 while suspended). Then confirm the app loads and someone can sign in.
2. `npm run db:verify` — must report the ledger in step with `supabase/migrations` up to 0270.
3. `npm run db:apply` — applies 0271 → 0300 in order (the ledger is `public._agent_migrations`). Never paste SQL by hand.
4. `npm run db:verify` again — must show 0300 as the last applied.

Each migration is idempotent: if `db:apply` stops part-way, fix the cause and run it again.

## 1. The migrations, and one check each

Run the checks in the Supabase SQL editor. All are read-only, except the 0284 `update audit_log`, which is
expected to be refused. Every SQL check here was run on 2026-11-20 against the PG 16 replay and returned what this
table says (on an empty database, "runs" means it returned a row count of 0 without an error).

| # | What it does | Check |
|---|---|---|
| 0271 | Storage/DB usage for `/api/health` quota warnings | `curl https://elostate.com/api/health` → `backend.quota.fileStorage.level` is not `"unknown"` |
| 0272 | Reporting tree (`profiles.manager_id`), score provenance + archive, AI cost ledger (`ai_usage`, `ai_prices`) | `select count(*) from ai_usage;` runs (0 is fine) |
| 0273 | Managers see only their reports once every rep has a manager | `select rss_tree_active('<company id>');` → `false` until managers are set |
| 0274 | The remaining rep-scoped policies follow the tree | `select count(*) from pg_policies where qual ilike '%rss_tree_allows%' or with_check ilike '%rss_tree_allows%';` → 34 (as replayed on PG 16) |
| 0275 | Remote capture (phone/video context, session failures) | `select count(*) from session_failures;` runs |
| 0276 | Keyword trackers + hits | `select count(*) from keyword_trackers;` runs |
| 0277 | Segment end times + interaction stats; current-transcript view | `select count(*) from coaching_transcript_segments_current;` runs |
| 0278 | Coaching loop (listens, feedback requests, coaching events) | `select count(*) from feedback_requests;` runs |
| 0279 | Notification type `feedback_requested` | see the 0294 check |
| 0280 | Library, snippets, saved searches | `select count(*) from library_items;` runs |
| 0281 | Follow-through (callbacks → tasks) | `select count(*) from session_follow_through;` runs |
| 0282 | Training (scenarios, assignments, due changes, attempts) | `select count(*) from training_assignments;` runs |
| 0283 | Notification type `training_attempted` | see the 0294 check |
| 0284 | Audit log, retention setting, trims (+ restores), erasure requests; trimmed lines leave the current-transcript view | `select count(*) from audit_log;` runs; `update audit_log set action = action;` → **error "audit_log is append-only"** (expected) |
| 0285 | Erasure (AMD-014): conditional append-only rules, `rss_erasure_matches`, `rss_erase_sessions` | `select proname from pg_proc where proname in ('rss_erasure_matches','rss_erase_sessions');` → 2 rows |
| 0286 | Webhooks: endpoints, deliveries, attempts; enqueue triggers | `select tgname from pg_trigger where tgname like 'rss_webhook_on_%';` → 2 rows |
| 0287 | `rss_tree_blockers` (who keeps the tree off) | `select * from rss_tree_blockers('<company id>');` lists reps with no manager |
| 0288 | Invitations can carry a manager | `select manager_id from team_invitations limit 1;` runs |
| 0289 | Notification type `call_ready` | see the 0294 check |
| 0290 | `is_sales_coach_manager()` uses `admin_roles()` (CFO counts) | `select prosrc from pg_proc where proname = 'is_sales_coach_manager';` contains `admin_roles()` |
| 0291 | The other 9 admin-role copies + the invite policy use `admin_roles()` | `npm run invariant:audit` is green (INVARIANT 39) — it reads the migrations, so also: `select count(*) from pg_proc where prosrc ilike '%''CEO'', ''COO''%';` → 0 |
| 0292 | A removed person is not an admin in those helpers | sign in as nobody; nothing to check by hand beyond `db:verify` |
| 0293 | Comment visibility + @mentions | `select visibility from recording_comments limit 1;` → `everyone` |
| 0294 | Notification type `comment_mention` | `select pg_get_constraintdef(oid) from pg_constraint where conname = 'manager_notifications_type_check';` lists `call_ready` and `comment_mention` |
| 0295 | Trimmed lines hidden from the base transcript table too; the trim test answers only for the caller's company (security review) | signed in as a rep with a trimmed call: `select count(*) from coaching_transcript_segments where session_id = '<id>';` excludes the trimmed lines |
| 0296 | Second security review: an invitation's manager is applied only for the signed-in person accepting their own invitation; manager_id immutable; invited_by must be the inviter; comment + mentions in one transaction; the comment-visibility test answers only for the caller | `select pg_get_functiondef('public.rss_insert_comment(uuid,uuid,uuid,integer,text,boolean,text,uuid[])'::regprocedure);` exists; as a member, `update team_invitations set manager_id = '<any>' where id = '<pending>';` → `manager_id is immutable` |
| 0297 | An invitation is accepted only through accept_invitation (a member can no longer mark someone's invitation accepted); revoking is unchanged | as a member, `update team_invitations set accepted_by = '<any>' where id = '<pending>';` → `accepted only through accept_invitation`; accepting a real invite from the join link still works |
| 0298 | RLS helpers called from read policies (rss_tree_allows, rss_comment_base_visible, rss_comment_mentions_me, rss_line_trimmed) answer an anonymous caller with "no" instead of a permission error | `npm run db:apply`'s verify:live: "ROLE anon reads 0 from POPULATED tenant tables" PASS |
| 0299 | rss_unreferenced_uploads — the one rule for recordings nothing points at (cleanup + nightly sweeper) | `select count(*) from rss_unreferenced_uploads(interval '24 hours');` as the service role → 0 after the 2026-11-21 cleanup |
| 0300 | coaching_sessions.audio_started_at — a live recorder's start on spoken_at's clock; the trim filter's base | after a live call recorded post-push: `select audio_started_at - started_at from coaching_sessions where id = '<id>';` is a few seconds; a trim on that call hides the words heard at that moment |

## 2. Settings outside the repository (blocking for their features)

| Setting | Where | Without it |
|---|---|---|
| `RSS_WEBHOOK_SIGNING_SECRET` (`openssl rand -hex 32`) | Vercel, app project | Webhooks queue but are not sent; Settings → Protection says so |
| Google / Microsoft providers + Redirect URL `https://elostate.com/auth/callback` | Supabase dashboard; see `docs/AUTH-REDIRECTS.md` "OAuth providers" | Sign-in buttons stay hidden |
| `NEXT_PUBLIC_AUTH_PROVIDERS` (`google`, `azure`) | Vercel, after the providers verify | Same |
| AI prices | `/dashboard/admin/ai-cost` → Prices | The AI cost page shows "price missing" |

## 3. Decisions (updated 2026-11-23)

All plan decisions the build depended on are decided — D4 lockout, D6 phone & video rubric, D14 retention (90 days),
D18 trainings on Remote Sales → Training, and the rest; see `docs/rss/DECISIONS-2026-11-22.md`. Left undecided on
purpose: D11 (legal wording of a recording notice), D12 (meeting bot) and D13 (dialer).

## 4. Looked at, on a real phone, after applying

1. Team page: set a manager for every rep → the "reporting lines aren't in force" notice disappears; a manager sees only their reps.
2. Upload a phone call → the bell says "Your uploaded call … is ready"; the call page shows talk-time stats.
3. Trim 10 seconds of that call → playback skips it; the transcript no longer shows those lines; the audit log shows the trim.
4. Settings → Protection: set retention to 30; erase a test customer by phone number → their calls lose transcript and audio, the audit log shows the request.
5. Recordings tab: comment "Only the people I mention", mention a manager → they get the bell; the rep does not see it.
6. Webhooks: add a test receiver, "Send a test" → it verifies with the shown secret.
7. Training (once D18 places the screen): turn a call into a scenario, assign it, practise as the rep → the manager's bell.

## 5. After the 23 November push — what to look at (all migrations through 0307 are already applied)

Each needs a real call in desktop Chrome on elostate.com, after Vercel shows the new build.

1. **Both voices recorded.** Remote Sales → start a video call, tick "Share tab audio" in Chrome's picker. After it
   ends: the saved audio has both sides, and the transcript has "Prospect" lines. Once without ticking it: the rep is
   told only their side is recorded.
2. **Consent.** Starting (or uploading) a phone/video call asks the rep to confirm "The prospect knows this call is
   recorded".
3. **Phone & video rubric.** The call's score panel names the phone & video rubric (attfiber-remote-v1); its items —
   "Reason for the call", "Into enrollment, on the call" — appear in the breakdown and in Remote Search's rubric filter.
4. **Too short.** A call under 100 rep words shows "Too short to score" and earns no points.
5. **Macro Mode.** Remote Sales → Calls → turn Macro Mode on; open the call: Highlights (brief, key points, next steps,
   follow-up draft), Coaching (score, review, comments), Next Meeting (checklist saves into the prospect's to-dos);
   Today plans a day.
6. **Unscored calls.** As a manager: Today shows "N phone/video calls are waiting to be scored" when any are; Coaching
   shows the panel and scores them. A rep sees neither.
7. **Retention.** Settings → Protection says "audio is kept for 90 days (the standard setting)".
8. **Nightly jobs** (Vercel → Cron logs, next morning): the recording clean-up reports `defaultRetentionDays: 90`; the
   unreferenced-upload sweep reports 0 or a small, audited number.

