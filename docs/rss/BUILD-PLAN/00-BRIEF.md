# ELOSTATE Remote Sales System — Brief

> **This is the brief, not the method.** The method is BUILD-STARTER V6, plus ELOSTATE's own
> CLAUDE.md, ThinkerThinker.md and TBC protocol. The agent must not invent an answer to anything
> left blank here. Nothing is deleted: unanswered items read **NOT DECIDED**, so the gap stays
> visible. The same plan, indexed by topic, is in `docs/00`–`08`.

## 1. What is being built

An addition to the live ELOSTATE (TeamPilot) Sales Coach that captures, scores and coaches **phone
and video** sales sessions to Gong's level, with a reporting tree so each manager coaches their own
team. [ASSUMED scope — D1]

## 2. The domain entity and its lifecycle

A **remote sales session**: `coaching_sessions` with `session_kind = 'sales'`, `context in ('phone','video')`.

`live → uploading → awaiting_outcome → (rep picks an outcome) → transcribing → analyzing →
scoring → scored`, with `not_scored` (below floor / not a sales call) and `failed` (closed reason
list). The rep closes it, only with an outcome. The system moves it through processing. Only a
manager re-scores, with a reason, and the old score is archived first. Points bank once and never
re-bank. Full table: `docs/01-SCOPE.md`. Code: `src/lib/coach/remote/session/state.ts`.

## 3. Who uses it

- **Rep:** runs and uploads remote sessions, must pick an outcome, sees their own scores, stats,
  trackers and evidence, disputes, requests feedback from anyone above them, does assigned
  practice. Can't re-score, trim, delete or move a due date.
- **Manager:** all of that for their own reports at any depth (today: the whole company): comment,
  override, re-score with a reason, clip, curate the company library, trackers, scenarios,
  assignments, trims.
- **Company admin:** the whole company (D2), plus retention, erasure, audit log, webhooks.
- **ELOSTATE vendor admin:** AI cost ledger and prices. Never shown to tenants.

## 4. Brand

The shipped Sales Coach UI: zinc-950 / zinc-900 / zinc-700 / zinc-400, yellow-400 `#FACC15` as the
only accent, system font, phone-first [OBSERVED, Sept 2026 measurement]. The repo's theme files are
the source; `theme:audit` enforces them. The ELOSTATE brand kit (`#FFDA03` on `#0A0A09`, Montserrat
/ Inter) is for the parent brand and marketing, not this UI. New rule: no status, outcome or speaker
shown by colour alone.

## 5. Reference material

`BUILD-PLAN/reference/`, in precedence order: live repo → BUILD-STARTER V6 → scaffold tests →
open decisions → *what it takes to match* (Part A only) → comparison JSON (346 features with
file:line evidence) → Gong teardown JSON. Details: `reference/README.md`.

## 6. Real content

- **Copy:** UI strings only. Plain words. No consent or notice wording (D11). No benchmark shown as
  a goal.
- **Rubric content for phone and video:** **NOT DECIDED** (D6). Who writes it, against which
  script: —
- **Tracker phrase lists:** managers enter them in the product. None are seeded.
- **AI prices:** an ELOSTATE admin enters them in `ai_prices`. None are seeded.
- **Photography:** none needed.

## 7. Data that already exists

The live ELOSTATE Supabase database: profiles, coaching_sessions, versioned transcripts, pitch
scores with evidence, overrides, disputes, points ledger, recording comments and consent events,
door knocks, KPI snapshots. **No migration from another system.** Existing remote sessions get
stats backfilled through the existing backfill drain. Production has **zero** sales sessions with an
outcome today [OBSERVED `deriveGoal.ts:13`]. The required-outcome rule fixes this from the day it
ships; history stays as it is.

## 8. Deployment

Vercel: ELOSTATE is John's product, deployed as today. Migrations only through `npm run db:apply`.
One new env key (`RSS_WEBHOOK_SIGNING_SECRET`, Phase 9). Method and credentials:
BUILD-STARTER V6 `05-DEPLOYMENT-METHOD.md`. Details: `docs/08-DEPLOYMENT.md`.

## 9. Hard constraints

- Door-to-door behaviour doesn't change, except for the shared foundations.
- Every policy ships with an allowed test and a refused test. `npm run check` is green between phases.
- Points bank once. A re-score never moves the scoreboard.
- No price, consent wording, certification or statistic is invented.
- Nothing from the "deliberately not built" list reaches a migration without a decision.
- Undecided rules throw `NotDecidedError` (HTTP 409). They never get a silent default.
- Existing policies switch to the reporting tree only after that company's managers are set.

## 10. What "done" means

A phone rep uploads a 20-minute call, closes it with an outcome, and watches it reach Ready. The
session page shows talk-time lanes, interaction stats, tracker hits, and a scored rubric with
evidence (plus the D6 caveat if no phone rubric exists). Only the rep's own manager chain gets the
alert. That manager can listen (logged), clip a snippet, comment, and close the rep's feedback request.

---

## Decisions log

Append only. Never rewrite a row.

| Date | Decision | Chosen | Why |
|---|---|---|---|
| 2026-08-18 | Consent for in-person door recording | Handled legally; no in-app gate | John's decision, recorded in the codebase (0215) |
| Sept 2026 | Points | Per session from the AI judge, banked once, even with no sale | John's sales-coach decisions |
| Sept 2026 | Manager alerts | In-app only | John's decision (the code also has a weekly email digest: D10) |
| 2026-11-13 | Build the Remote Sales System from *what it takes to match*, Part A | Yes | John asked for this build plan after reading that doc |
| 2026-11-13 | Reps refused at the re-score API | Stand-in for D3 | The UI already hides the button from reps; the API was the gap |
| 2026-11-15 | D1 scope | Phone + video only; door unchanged except shared foundations | Founder picker, the plan's recommended option |
| 2026-11-15 | D2 company admins' view | Keep company-wide | Founder picker; nobody loses access the day the tree ships |
| 2026-11-15 | D3 re-score and earlier overrides | Archive first; flag earlier overrides, never re-apply | Founder picker; an override may not fit the new grade |
| 2026-11-15 | Placement: migrations renumbered 0271→0272 … 0279→0280 | 0271 was taken by `0271_system_storage_usage.sql` | README-PLACEMENT: renumber to the next free number |
| 2026-11-15 | Scaffold modules land with their phase, not all at Phase 0 step 1 | Repo gate `reachability:audit` fails any src module nothing imports | Live repo outranks the scaffold in the plan's precedence order |
| 2026-11-15 | F25.9 required outcome for phone/video | Not adopted: the outcome prompt stays skippable on every channel | Founder picker; the 2026-08-29 ruling (a forced field gets rushed taps, §3.5) stands |
| 2026-11-15 | Segment end times for Phase 2 stats | Store real end times for new calls; older calls estimated ("until the next person speaks") and labelled so | Founder picker |

## Open questions

| # | Question | Blocks |
|---|---|---|
| D1 | Does "Remote Sales System" mean phone + video only? | Everything's scope |
| D2 | Company admins keep company-wide view? | Phase 0 step 8 |
| D3 | Re-score rules: re-apply earlier overrides, or flag them? | Phase 0 step 5 |
| D4 | Lockout numbers | Phase 0 step 7 (lockout only) |
| D5 | Scoring floor | Phase 3 |
| D6 | Phone and video rubric content: who writes it? | Phase 3 caveat removal |
| D7 | Three-level grades or ranges + question builder | Nothing now; blocks any rubric editor |
| D8 | What counts as feedback and as listened | Phase 4 metrics page |
| D9 | Voice role-play; practice scored by the pitch rubric | Phase 7 voice |
| D10 | Weekly email digest vs in-app only | Nothing in RSS |
| D11 | Recording notice for phone/video | Go-live with phone clients |
| D12 | Meeting bot | Not in this plan |
| D13 | Dialer / telephony | Not in this plan |
| D14 | Retention default | Phase 8 |
| D15 | Redaction on, digit length | Phase 8 |
| D16 | Upload limit | Phase 1 step 5 |
| D17 | Languages | Non-English clients |
| D18 | Trainings: Bootcamp or Training tab | Phase 7 UI |
| D19 | Interaction-stat parameters | Nothing; constants |
| D20 | Follow-up email draft | Nothing; PROPOSAL |
