# 05 — Routes

New and changed routes, in the live repo's existing layout (`src/app/api/coach/sales-session/...`).
Every route accepts cookie or Bearer auth through the existing `resolveApiAuth`, so the native app
and the extension work unchanged. Every write goes through RLS as the signed-in user, unless the
**Auth** column says service role.

## Changed

| Route | Phase | Change |
|---|---|---|
| `POST /api/auth/sign-in` *(new server route; both login pages call it)* | 0 | Records each attempt in `login_attempts`; calls `lockout.evaluate()`. It catches `NotDecidedError` and continues until D4 is decided, so sign-in never breaks. |
| `POST /api/coach/sales-session/pitch-score` | 0 | Calls `resolveScoreRequest()`. A rep gets `skipIfScored:true` always; a re-score needs a manager and a reason, archives first, writes provenance, and writes an `audit_log` row. **Today's line `pitch-score/route.ts:103` is the defect.** |
| `POST /api/team/set-manager` *(new, beside `team/set-role`)* | 0 | Company admin sets `manager_id`; `assertValidManager()` first, the DB trigger second. |
| `lib/coach/gamification/notify.ts` | 0 | Recipients = `managerChain(rep)` instead of every manager. Behind a per-company check: only once that company has any `manager_id` set. |
| `lib/llm` `llmCall` / `llmStream` | 0 | After each call, insert one `ai_usage` row (service role). STT batch: insert audio seconds. |
| `POST /api/coach/sales-session/[id]/finalize` | 1 | For phone/video: refuse without an outcome (`closeWithOutcome()`). Door sessions are unchanged. |
| `POST /api/coach/sales-session/[id]/upload-recording/sign` | 1 | Size limit from `UPLOAD_MAX_BYTES` (D16). Over the limit → `TOO_LARGE` in `session_failures`, shown to the rep. |
| Pipeline (transcribe → analyse → score) | 1–3 | Writes `session_failures` with the closed reasons; computes `session_interaction_stats` and `tracker_hits` when a transcript version lands; picks the rubric with `rubricFor(channel)`. |
| `POST /api/coach/sales-session/pitch-recordings/comment` | 2 | Adds `mentions[]` and `visibility` (everyone / named / only me). Still append-only. |
| `GET /api/search` | 5 | Adds sales sessions and transcript lines, filtered by `rss_can_view_rep`. |

## New

| Route | Phase | Auth | Purpose |
|---|---|---|---|
| `GET /api/coach/remote/[id]/stats` | 2 | user | Interaction stats + talk-time lanes |
| `GET /api/coach/remote/[id]/transcript?q=` | 2 | user | In-session search, line → ms |
| `GET/POST /api/coach/remote/trackers` | 3 | user (managers write) | List / create; `PATCH` deactivates |
| `POST /api/coach/remote/[id]/feedback-request` | 4 | user (rep) | Ask someone above you |
| `POST /api/coach/remote/[id]/listen` | 4 | user | Batched listen ranges from the player (every 15 s and on pause) |
| `GET /api/coach/remote/coaching-inbox` | 4 | user (manager) | Per-report rows: last feedback, last listened, overdue, open requests |
| `GET /api/coach/remote/coaching-metrics` | 4 | user (manager) | Per-manager counts; **returns 409 "D8 not decided" until D8 is decided** |
| `GET /api/coach/remote/sessions?…filters` | 5 | user | Filters from 02 Phase 5; full-text over transcripts |
| `GET/POST/DELETE /api/coach/remote/saved-searches` | 5 | user | Owner only |
| `POST /api/coach/remote/[id]/snippets` | 5 | user | `validateSnippet()` then insert |
| `GET/POST /api/coach/remote/library` (+ `/items`) | 5 | user | Folders and items; company items need consent |
| `GET /api/coach/remote/sessions.csv` | 5 | user (manager) | Export the filtered list; writes `audit_log` |
| `GET /api/coach/remote/[id]/download?kind=audio|transcript` | 5 | user (manager) | Signed URL; writes `audit_log` |
| `POST /api/coach/remote/[id]/callbacks` | 6 | pipeline | Action items → existing Tasks (`/api/tasks/spawn`) |
| `POST /api/coach/sales-session/[id]/ask-coach` *(extend)* | 6 | user | Multi-turn: `chatId`; answers with `[{at_ms}]` citations |
| `GET/POST /api/coach/remote/scenarios` | 7 | user (managers write) | Stored scenarios |
| `GET/POST/PATCH /api/coach/remote/assignments` | 7 | user | Assign / list / manager edits due date |
| `GET/PUT /api/coach/remote/settings/retention` | 8 | company admin | `company_recording_settings` |
| `POST /api/coach/remote/erasure` | 8 | company admin | File a request; the job runs with the service role |
| `POST /api/coach/remote/[id]/trim` | 8 | manager | Insert trim; reprocess; `audit_log` |
| `GET/POST/PATCH /api/coach/remote/webhooks` | 9 | company admin | Endpoints (`assertEndpointUrl`) |
| Webhook sender (cron, `vercel.json`) | 9 | service | Signs `${ts}.${body}` with `RSS_WEBHOOK_SIGNING_SECRET`; headers `X-Elostate-Timestamp`, `X-Elostate-Signature`; retries with backoff; logs `webhook_deliveries` |
| `POST /api/team/import-csv` | 9 | company admin | Bulk add + managers; one error report per row |

## Rules every route follows

- **Rules are imported, not re-typed.** Routes call `state.ts`, `rescore.ts`, `feedback.ts` and the
  rest. They never copy the logic.
- **An undecided rule answers honestly.** `NotDecidedError` maps to HTTP 409 with the decision
  number. It never becomes a silent default.
- **Rate limits.** Every new AI-touching route goes through the existing in-memory limiter
  (`rateLimit.ts`).
