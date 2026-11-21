# 02 — Feature menu

Every feature in the Remote Sales System, tagged:

- **SETTLED**: already in the live app, or you decided it (date given). Reused, not rebuilt.
- **DESIGNED**: from Part A of *Gong vs ELOSTATE: what it takes to match*, which you followed by
  asking for this build. It has schema, code and tests here.
- **PROPOSAL**: not asked for. It is not in the schema, the tests or any requirement. It waits for
  your yes.

`Gong` gives the teardown ID and our status from the comparison (Have / Partial / Different / Lack).

## Phase 0 — Foundations

| Feature | Tag | Gong | Where |
|---|---|---|---|
| Reporting tree (`profiles.manager_id`), loop and company guard | DESIGNED | F2.4 Partial | 0271, `access.ts` |
| Managers see only their reports, at any depth | DESIGNED | F3.2 Partial | `rss_can_view_rep()`; policy switch is a Phase 0 step |
| Alerts go up the rep's manager chain, not to every manager | DESIGNED | F16.1 / `notify.ts:7` | `managerChain()` |
| Reps can't re-score; managers re-score with a reason; old version archived | DESIGNED | F15.15 Partial | `rescore.ts`, 0271 archive |
| Model and prompt version stored with every score | DESIGNED | F15.8 gap | 0271 provenance |
| Sign-in attempts recorded; lockout rule | DESIGNED (numbers D4) | F1.5 Lack | 0271, `lockout.ts` |
| AI cost ledger + admin-entered prices, vendor-only | DESIGNED | F28.7 Partial | 0271, `cost.ts` |
| Points banked once per session | SETTLED (Sept 2026) | F19.1 Have | existing |

## Phase 1 — Remote capture

| Feature | Tag | Gong | Where |
|---|---|---|---|
| `phone` as a session context | DESIGNED [INFERRED: remote includes phone] | — | 0272 |
| Outcome required to close a phone or video session | DESIGNED | F25.9 Partial | `closeWithOutcome()` |
| Processing stage chips (Uploading → Ready) | DESIGNED | F6.6 Partial | `STAGE_CHIPS` |
| Closed list of failure / not-scored reasons, visible to managers | DESIGNED | F5.9 Partial | 0272, `state.ts` |
| Explicit `TOO_LARGE` instead of a generic failure | DESIGNED | F5.7 Partial | `state.ts` |
| Larger uploads for long calls | DESIGNED (limit D16) | F6.3 Partial | route change, Phase 1 |
| Completion notice when an upload finishes processing | DESIGNED | F6.3 Partial | in-app notification |
| Live session through the mic, file upload, Chrome extension | SETTLED | — | existing |

## Phase 2 — Remote session page

| Feature | Tag | Gong | Where |
|---|---|---|---|
| Player on the session page (not only the manager Recordings tab) | DESIGNED | F9.2 Partial | UI |
| Talk-time lanes per speaker; tap a lane to hear only that speaker | DESIGNED | F9.3 Lack, F9.2 | `talkTimeLanes()` |
| Talk ratio by **time** (beside today's word-based ratio) | DESIGNED | F10.1 Different | `stats.ts` |
| Longest monologue, longest customer story, interactivity, patience, questions per hour | DESIGNED | F10.2 Lack, F10.3–F10.6 | `stats.ts`, 0273 |
| Transcript search on the page; click any line to seek | DESIGNED | F9.4 Partial | UI |
| Comment @mentions and visibility (everyone / named / only me) | DESIGNED | F9.8 Partial | route change on 0259 |

## Phase 3 — Remote scoring

| Feature | Tag | Gong | Where |
|---|---|---|---|
| One active rubric per channel; remote caveat until a remote rubric exists | DESIGNED (content D6) | F15.9 Partial | 0274, `rubric.ts` |
| N/A per rubric element, section rescaled | DESIGNED | F15.5 Partial | `rescaleSection()` |
| Scoring floor | DESIGNED (value D5) | F15.7 Partial | `scoringDecision()` |
| Keyword trackers (manager-made phrase lists), hits with timestamps | DESIGNED | F11.1 Lack | 0274, `trackers.ts` |
| Tracker hits as session-list filters | DESIGNED | F11.9 Partial | Phase 5 filters |
| Evidence quotes with jump-to-moment, overrides with a reason, disputes | SETTLED | F15.14, F15.20, F15.21 Have | existing |
| Dispute notifications to manager and rep | **PROPOSAL** (the comparison found the gap; the match doc didn't ask for it) | F15.21 gap | — |

## Phase 4 — Coaching loop

| Feature | Tag | Gong | Where |
|---|---|---|---|
| Request feedback from anyone above you, on your own session | DESIGNED | F16.1 Partial | 0275 |
| Request open/closed derived from later manager action | DESIGNED | F16.4 Partial | `isRequestOpen()` |
| Listening tracked per manager, rep, session | DESIGNED | F16.10 Lack | 0275 |
| What counts as feedback; what counts as listened | DESIGNED (rules D8) | F16.2 Lack | `feedback.ts` |
| Coaching inbox columns: last feedback, last listened, overdue, open requests | DESIGNED | F16.5 Partial | Coach Assessment |
| Inbox filters: no feedback yet; switch team (managers of managers) | DESIGNED | F16.6 Partial | Coach Assessment |
| Coaching metrics per manager | DESIGNED (counts D8) | F16.8 Lack | new page |
| Pattern "Mark as coached" with improving / stalled follow-up | SETTLED | F16.3 Different (ahead) | existing |

## Phase 5 — Find and reuse

| Feature | Tag | Gong | Where |
|---|---|---|---|
| Full-text transcript search across sessions | DESIGNED | F12.1 Partial | index on the live transcript table |
| Filters: rep, channel, outcome, score range, element hit/missed, tracker, talk ratio, disputed | DESIGNED | F12.1 | session list |
| Saved searches (private) | DESIGNED | F12.2 Lack | 0276 |
| Snippets | DESIGNED | F9.13 Lack | 0276, `snippets.ts` |
| Library: personal and company folders; approved examples playable by peers | DESIGNED | F12.5, F12.6, F9.10 | 0276 |
| Sales sessions in global search | DESIGNED | F12.4 Partial | `/api/search` |
| Session list CSV export; audio and transcript download (managers) | DESIGNED | F12.3, F9.15 | routes |

## Phase 6 — Follow-through

| Feature | Tag | Gong | Where |
|---|---|---|---|
| Callback to-dos from action items said in the call | DESIGNED | F26.4 Partial | existing Tasks module |
| AI-suggested outcome beside the rep's own | DESIGNED | F25.11 Lack | engine |
| Ask Coach: multi-turn, saved, clickable timestamp citations | DESIGNED | F13.8, F13.9 Partial | engine + UI |
| Ask across several sessions | DESIGNED | F13.13 Partial | engine |
| Follow-up email draft | **PROPOSAL** (D20) | F13.7 Lack | — |

## Phase 7 — Training

| Feature | Tag | Gong | Where |
|---|---|---|---|
| Stored, reusable scenarios (channel, difficulty, length, optional pass mark, from a real session) | DESIGNED | F17.3 Partial | 0277 |
| Assignments with due dates | DESIGNED | F17.10 Lack | 0277 |
| Manager notified on submission | DESIGNED | F17.11 Lack | needs a new `manager_notifications` type |
| Follow-up chat after a practice attempt | DESIGNED | F17.8 Lack | reuses Ask Coach |
| Voice role-play; scoring practice with the pitch rubric | NOT DECIDED (D9) | F17.5, F17.6 | — |
| Practice kept out of points and scoreboards | SETTLED | F17.9 Have | existing |

## Phase 8 — Protection

| Feature | Tag | Gong | Where |
|---|---|---|---|
| Append-only audit log (override, delete, export, trim, re-score) | DESIGNED | F31.5 Partial | 0278 |
| Retention setting per company | DESIGNED (default D14) | F33.1 Partial | 0278 |
| Erasure requests by phone, email or client label | DESIGNED | F33.6 Partial | 0278 |
| Trim a section out of a recording | DESIGNED | F9.17 Lack | 0278 |
| Number redaction in transcript and audio | DESIGNED, off (D15) | F33.3 Lack | `redaction.ts` |

## Phase 9 — Reach

| Feature | Tag | Gong | Where |
|---|---|---|---|
| Signed webhooks: session.scored, session.closed, deal.closed | DESIGNED | F31.8 Lack | 0279, `webhooks.ts` |
| Google and Microsoft sign-in | DESIGNED | F1.2 Lack | Supabase OAuth |
| Bulk team upload with managers (CSV) | DESIGNED | F2.8 Lack | route |
