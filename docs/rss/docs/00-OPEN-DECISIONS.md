# 00 — Open decisions (READ FIRST)

Every thing below is undecided. The build does **not** invent an answer to any of them. Each has
something standing in for it today: today's live ELOSTATE behaviour kept on purpose, or code that
refuses to run (`NotDecidedError`) so the gap is loud. All the stand-ins live in one file:
`elostate-remote-sales/src/lib/coach/remote/decisions.ts`.

To decide one: change `decisions.ts`, update this table, and append a row to the decisions log
in `BUILD-PLAN/00-BRIEF.md`. You can answer in one word; the cost column says when it starts to
matter.

| # | Decision | What stands in for it today | Cost of changing later |
|---|---|---|---|
| D1 | What "Remote Sales System" covers | **DECIDED 2026-11-15: phone + video only.** Was [ASSUMED]: phone and video sales sessions, brought to Gong parity on coaching, plus the shared foundations they need. Door-to-door is unchanged. | Low now. High after Phase 3, because scoring, stats and trackers are scoped by channel. |
| D2 | Do company admins keep company-wide access once managers see only their teams? | **DECIDED 2026-11-15: yes, company-wide.** Was the stand-in: today's behaviour (`COMPANY_ADMINS_SEE_ALL = true`) | Low. One function (`rss_can_view_rep`) and one constant. |
| D3 | Who may re-score, and is the old version kept? | **DECIDED 2026-11-15: managers only, with a reason, archive first; earlier overrides are flagged, not re-applied.** Was the stand-in: managers only, with a reason; the old score and evidence are archived first | Low before Phase 3. Once disputes and overrides refer to archived versions, changing the rule means migrating history. |
| D4 | Account lockout: failures, window, lock length | **DECIDED 2026-11-22 (founder, picker): 5 failures in 60 minutes lock for 60 minutes** (Gong's rule), enforced by the sign-in route before the password is tried. | Someone typing another person's email can lock that account for an hour; email reset still works. |
| D5 | Minimum transcript before a session is scored | Today's behaviour: one rep segment (`generatePitchScore.ts:47`). Gong: 100 words. | Low now. Medium after Phase 3: changing it shifts scoreboard eligibility (points are banked once). |
| D6 | Which rubric scores phone and video calls | The existing AT&T Fiber door rubric scores everything, and remote score panels print the caveat "Scored with the company rubric: no phone rubric yet" | Medium. Every remote score made before a remote rubric exists stays on the old rubric version. That is correct, but it isn't comparable. |
| D7 | Keep hit / partial / missed, or add numeric ranges and a question builder | Three levels kept | High after Phase 3: a question builder changes the rubric's data shape. |
| D8 | What counts as "feedback given", and what counts as "listened" | **DECIDED 2026-11-22 (founder, picker): `GONG_RULES`** (a comment sent to the rep, a score correction, a dispute answer, a pattern marked coached; never AI scores or drafts) **and listened = at least half the call.** Coaching metrics now show in Remote Sales → Coaching. | History is counted by these rules. |
| D9 | Voice role-play? Score practice with the pitch rubric? | Text role-play unchanged; practice keeps its 0–100 focus score | Medium. Voice needs a realtime speech model and a cost line; rubric scoring changes what practice scores mean. |
| D10 | Manager alerts in-app only, or keep the weekly email digest? | Unchanged: `weeklyDigest.ts:12` still emails managers. New RSS notifications are in-app only. | Very low. |
| D11 | Recording notice for phone and video calls | None, same as today. **No wording is drafted here.** The software must not imply that a call was announced or consented to unless that actually happened. | Medium. The rep's legal exposure grows with every recorded call. |
| D12 | Meeting bot for video calls: build, buy, or stay mic-and-upload? | Mic (live session, Chrome extension) and file upload | High, and it sits outside this plan: a bot is its own product. |
| D13 | Phone capture: a dialer, telephony import, or extension plus upload? | Chrome extension (Google Voice etc.), mic, upload | High. A dialer brings numbers, carriers and regional recording rules. |
| D14 | Default recording retention per company | No row means today's behaviour: keep each rep's last 20 recordings | Low. One setting. |
| D15 | Number redaction: on or off, and the digit length | **DECIDED 2026-11-22 (founder, picker): ON, runs of 9+ digits.** Built at the one transcript writer (redact.ts; 364df23f) and switched on. | New calls only; older recordings stay unredacted. Spoken-word numbers not caught; audio unchanged. |
| D16 | Upload size limit for remote calls | Today's 25 MB, plus an explicit `TOO_LARGE` reason | Low. Storage cost and quota grow with it, after this week's storage-quota suspension. |
| D17 | Languages for remote calls | English only (speech-to-text is fixed to English on purpose) | Medium. Every engine prompt and the trackers assume English. |
| D18 | Where trainings live: Bootcamp, or the Sales Coach Training tab | Tables built; screen placement open | Low. |
| D19 | Interaction-stat parameters | **[ASSUMED]** acknowledgement ≤ 1 s isn't a speaker switch. Interactivity window and cap follow Gong (5 min, 10). | Low. Constants in `decisions.ts`; recompute is cheap. |
| D20 | Build a follow-up email draft for phone and video reps (teardown F13.7)? | **Answered 2026-11-22** by the team's simplified-interface spec (founder: "a macro mode that will have this simplified remote sales system"): built in Macro Mode → Highlights — email and text drafts the rep copies and sends (bb0ec011). | — |

---

## D1 — What the Remote Sales System covers

**Options.** (a) Phone and video sales sessions only. (b) Everything in "Gong vs ELOSTATE: what it
takes to match", door included. (c) Remote plus Gong's revenue stack (deals, forecast, CRM).
**What I did.** (a) [ASSUMED]. Shared foundations (reporting tree, re-score lock, AI cost ledger)
also apply to door sessions, because they can't be split.
**Where it bites.** `session/state.ts` only covers `phone` and `video`. Door keeps the Door Log machine.

## D2 — Company admins' view

**Options.** Keep company-wide (today) · subtree only, like any manager · company-wide but read-only.
**What I did.** Kept today's behaviour, so nobody loses access on the day the tree ships.
**Where it bites.** `rss_can_view_rep()` in 0271 and `COMPANY_ADMINS_SEE_ALL`.

## D3 — Re-scoring

**Today.** The UI hides the button from reps, but the API lets the owner re-score
(`pitch-score/route.ts:103`, `skipIfScored:false`). The re-score replaces the score and deletes its
evidence (`0254:117`).
**What I did.** Reps are refused at the API (`rescore.ts`). This matches what the UI already
intends. Managers must give a reason. The old score and evidence are copied to
`pitch_score_archive` first. Points never re-bank (`RESCORE_CHANGES_POINTS = false`).
**Open.** Should a re-score re-apply earlier overrides automatically, or flag them for the manager?
Today: flag (nothing is re-applied).

## D4 — Lockout

**Options.** Gong: 5 failures → 60 min. Or Supabase limits only. Or a CAPTCHA after N failures.
**What I did.** Built the counter (`login_attempts`) and the rule (`lockout.ts`). It refuses to run
until you pick numbers. The sign-in route catches `NotDecidedError` and continues, so sign-in never
breaks.

## D5 — Scoring floor

**Where it bites.** A 15-second "not interested" on the phone gets a score today. With a floor, it
gets `BELOW_SCORING_FLOOR` and no score. That also means no points.

## D6 — Remote rubric

**Today.** One rubric in code (`rubric.ts:30`, AT&T Fiber door), and `rubric_config` isn't read.
**What I did.** 0274 lets a company hold one active rubric per channel. The current row becomes
`any`. A remote session scored by a non-remote rubric carries a visible caveat (`rubric.ts`).
**Not done.** Writing a phone or video rubric. That is sales content (who writes it, against which
script), not code.

## D7 — Grading scale

Today's three levels (hit 1, partial 0.5, missed 0) are a deliberate design. Gong's ranges and
question types only matter if clients edit their own rubrics.

## D8 — Feedback and listening

**Options coded.** `GONG_RULES`: sent comments, overrides, dispute answers and "coached" patterns
count; AI scores and drafts don't. `ALL_MANAGER_ACTIONS`: everything a manager does, except AI scores
and acting on their own session. Listening: a minimum number of seconds, or a share of the session.

## D9 — Role-play

Gong uses voice and scores practice with the live scorecard. Ours is text, with a focus score.
Nothing in this plan assumes either answer. Scenarios and assignments work with both.

## D10 — Weekly email digest

Your recorded decision is in-app only. The code emails managers top performers weekly. Pick one.
The plan doesn't touch the digest.

## D11 — Recording notice

The plan drafts no notice, consent or disclosure text. The software must not show "customer was
informed" or similar unless a step in the product actually did it. Whoever advises you writes the
wording.

## D12, D13 — Meeting bot, dialer

Both are listed under "deliberately not built" below. Each is its own product.

## D14–D20

See the table. Each has one constant or one row to change.

---

## Deliberately not built

| What | Why it is interesting | Why it is left out |
|---|---|---|
| Meeting bot that joins Zoom / Meet / Teams from the calendar (F5.1, F4.1) | Captures video calls with no rep action — Gong's core capture | D12; months of work per provider, or a paid vendor; your call |
| Dialer, numbers, telephony import (M25, F6.1) | Clean stereo phone audio, outcomes at hang-up | D13; carrier, regional and recording-law surface |
| Deals, pipeline, forecast (M20, M22) | Gong's revenue stack | Not asked for; door and remote sales here close per session |
| CRM sync (M29) | Writes outcomes back to Salesforce / HubSpot | ELOSTATE is no-CRM by design (F29.9); start with one CRM a paying client uses |
| Outbound sequences, enrichment (M24, M26) | Gong Engage | A different product |
| Public REST API, MCP server (M31, M32) | Integrations | Webhooks (Phase 9) first |
| Workspaces, per-person seats, permission editor (M2, M3) | Enterprise admin | Fixed roles are a deliberate choice; seats wait for billing |
| AI credits billing (M28) | Gong meters AI | The cost ledger (Phase 0) comes first; pricing is a business decision |
| Slack / Teams (F30.4, F30.5) | Alerts where managers live | Your recorded decision: in-app only |
| Streams (saved searches that alert, F12.7) | Push when a matching call lands | Pattern Interrupt covers the valuable case today |
| Customer share links, embeds (F9.11, F9.14) | Send a call to a customer | Not asked for; consent surface |
| Household / address record (F21.6) | Door revisits | Door, not remote |
| Follow-up email draft (F13.7) | Phone and video follow-up | D20 — PROPOSAL only |
| Translation, UI locales (F8.8, F8.10) | Non-English teams | D17 |
| Formula / metric builder, configurable dashboards (F23.2, F23.3) | Sales-ops teams | Fixed KPI screens are a deliberate choice |
