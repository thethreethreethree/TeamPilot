# 03 — Data model

Migrations: `elostate-remote-sales/supabase/migrations/0271`–`0279`, one per phase (Phase 6 needs
none). Apply **only** through `npm run db:apply` in the ELOSTATE repo, which records each one in
`public._agent_migrations`. Renumber first if 0271 is taken (see README-PLACEMENT).

Each migration that touches an existing table starts with a **preflight**. If the live schema
doesn't match what this plan read through the comparison's file:line evidence, the preflight fails
loudly instead of guessing.

## Access rule (one function everything uses)

`rss_can_view_rep(viewer, rep)` returns true when the two are in the same company and one of these holds:
the viewer is the rep · the viewer is a company admin (D2 stand-in) · the viewer is a manager and
the rep sits below them in `profiles.manager_id`, at any depth.
Helpers (all `security definer`, `search_path = public`): `rss_is_company_admin`, `rss_is_manager`,
`rss_is_below`, `rss_company_of`, `rss_session_rep`.

**Switching existing policies to the tree is a reviewed step, not part of 0271.** Policies to switch
[OBSERVED locations]: `pitch_scores` select (`0252:239`), coaching selects (`0084:40`),
`recording_comments` (0259), manager notification fan-out (`notify.ts:7`). Do it after admins have
set managers. Doing it before would hide every rep from every manager.

## New tables

| Table | Phase | Holds | Who reads | Who writes |
|---|---|---|---|---|
| `profiles.manager_id` (column) | 0 | Reporting line | — | Admins (via route); trigger blocks self, cross-company, loops |
| `pitch_score_provenance` | 0 | Model, prompt and rubric version, auto vs manager re-score | Rep + chain | Scorer (service role) |
| `pitch_score_archive` | 0 | The replaced score and evidence, with who and why | Rep + chain | Scorer (service role) |
| `login_attempts` | 0 | Email (lower-case), IP, success | **Nobody signed in** | Sign-in route (service role) |
| `ai_usage` | 0 | Tokens and audio seconds per model call | **No tenant**: vendor back office only | `llmCall` chokepoint |
| `ai_prices` | 0 | Admin-entered provider prices | Vendor only | Vendor admin |
| `session_failures` | 1 | Closed reason list | Rep + chain | Pipeline |
| `session_interaction_stats` | 2 | Talk ratio by time, monologue, story, interactivity, patience, questions/hour | Rep + chain | Pipeline |
| `rubric_config.channel` (column) | 3 | `any · door · phone · video`; one active per channel | existing | existing |
| `keyword_trackers` | 3 | Phrase lists, side, active | Company | Managers; **no delete** (deactivate) |
| `tracker_hits` | 3 | Hit, time, speaker, transcript version | Rep + chain | Pipeline |
| `feedback_requests` | 4 | Request from rep to someone above them | Requester, recipient, chain | Rep, own session only; **no update/delete** |
| `listen_events` | 4 | Listen ranges | Listener + whoever is above the listener | The listener, on sessions they may see |
| `snippets` | 5 | Clip of a session | Rep + chain; peers only via a company folder | Anyone who can view the rep |
| `library_folders` / `library_items` | 5 | Personal and company folders | Owner; company folders: company | Owner; company folders: managers; company items need rep consent |
| `saved_searches` | 5 | Private filter sets | Owner | Owner |
| `training_scenarios` | 7 | Reusable scenarios | Company | Managers |
| `training_assignments` | 7 | Rep + scenario + due date | Rep + chain | Managers of that rep; **rep can't move due dates** |
| `audit_log` | 8 | Who did what | Company admins | Server; **trigger blocks update/delete for everyone** |
| `company_recording_settings` | 8 | Keep-last-N per rep | Company | Company admins |
| `erasure_requests` | 8 | Erase by phone / email / client label | Company admins | Company admins; can't be filed pre-completed |
| `recording_trims` | 8 | Trimmed ranges | Rep + chain | Managers, not on their own sessions |
| `webhook_endpoints` / `webhook_deliveries` | 9 | Company endpoints and delivery log | Company admins | Admins / sender |

## Deliberately absent (decisions, not omissions)

- **No status column on `feedback_requests`.** Open or closed is derived from later events, the same
  way disputes work today (`readDisputes.ts`).
- **No price in code or `.env`.** `ai_prices` starts empty. A missing price shows as missing.
- **No tenant policy on `ai_usage`, `ai_prices` or `login_attempts`.** That absence is the
  enforcement.
- **No redaction settings table.** Redaction is code, off, until D15. The table appears when a
  decision needs one.
- **No retention default row.** No row means today's "keep last 20" (D14).
- **No FK from `pitch_score_archive` to `pitch_scores`.** A cascade would delete the history this
  table exists to keep, if the re-score path deletes and re-inserts.
- **No SQL constraint for "outcome required".** It's enforced in `closeWithOutcome()`. The live
  session status columns weren't readable. A `NOT VALID` check can be added once they are, so it
  only applies to new rows. Production has zero sales sessions with an outcome today.
- **No new `manager_notifications` type here.** Practice submission (Phase 7) needs one. The live
  check (`0242:78`) must be read and extended in its own migration.

## Wiring the placeholder

`rss_share_granted(session_id)` **raises** until it's wired to `recording_share_events` (0260). So
nothing reaches a company folder without the rep's consent, and the gap is visible. To wire it: read
0260's columns, then make it return true when the latest grant/revoke event for that recording is a
grant. The test `P5 … once wired` shows the expected behaviour against a stand-in table.

## Tests

`tests/sql/rls.test.ts` runs every migration on PGlite, on top of `tests/sql/fixtures/live-schema-stub.sql`
(test only — never applied anywhere). Each policy has an allowed case and a refused case: 48 tests.
A mutation check was run: removing the manager check from the tracker insert policy makes three
tests fail.
