# Session summary — 2026-07-09 (single entry point)

Everything built/fixed today, and the exact decisions + retests waiting on you.
Gate green throughout: tsc 0, lint 0, next build 0, 498 tests. All committed + pushed.

## What shipped

### 1. Feature — Session Interaction Flags (`/dashboard/sales-coach/sessions`)
"Needs Manager/Admin Examination" (negative interaction) + "Outstanding Performance
Review" (sold + positive) badges on session rows; clickable → composed explanation →
links straight into the session. Built, then FIXED after your "no badges" report:
v1 required pivot/moments analysis most sessions lack; now triggers on `no_sale`
outcome OR lost-pivot/cooling/breakdown, and Outstanding on `sold`. §A18: uses
manager-visible signals only (never owner-private scores). Examination is manager-only;
active sessions never flagged. Complete across all 4 AMD-006 layers. Fully unit-tested.
Details: `2026-07-09-session-interaction-flags.md`.
→ **RETEST:** reload Sessions as a manager; `no_sale` sessions should show "Needs
Examination", `sold` ones "Outstanding". A conditional server log prints why if none
appear (needs an outcome, or a pivot/cooling/breakdown signal). Remove the log once
confirmed.

### 2. Founder-reported bugs — fixed
- **Invite named the wrong person** ("Rebecca is already a member" for any email):
  `findAuthUserByEmail` took `users[0]` without matching the email. Fixed + 5 tests
  + captured as ThinkerThinker.md **A25**.
- **Removing a member did nothing** (RLS-blocked user-client write, false ok): now
  admin-gated service-role write + rowcount assertion; the Team page shows a red error
  on failure; recreate-path verified.
- **Duplicate-invite guard self-defeating** (`.maybeSingle` on 2+ rows): `.limit(1)` +
  migration `0098` (partial unique index).

### 3. Sales Coach audit — 15 bugs fixed
4 verified scouting agents + adversarial verification. HIGH: LLM quote-fabrication
reaching managers (grounding), stress-cue firing at the wrong speaker. MED: score
citation, breakdown demotion, empty-commit pace, triple-tap dedup, ELO/why
error-swallowing, ELO ordering, stale winning-lines. LOW: sep-reset, why crash-safety,
cue truncation, stale-cue-after-restart. Full report: `2026-07-09-sales-coach-audit.md`.

### 4. Security — app-wide
- **14 unauthenticated LLM routes gated** (4 coach + 10 app-wide: ai/chat/diagnosis/
  me/tasks). Anonymous callers could drive the model on your bill. Regression-verified:
  every caller is on the auth-gated dashboard — no legitimate caller breaks.
- **CRM silent edit-failures** — all 8 mutation handlers on the vendor CRM page
  swallowed failures (an admin's edit could silently fail on revenue data); now surface
  errors.
- **Transcript-injection vectors closed** — `segments` + `finalize` (both traced:
  only the rep calls them) are now owner-only, closing the §A18 hole migration 0082 named.
- **Resolution-review false-ok** fixed (rowcount assertion).

### 5. Methodology + records
Captured ThinkerThinker.md **A26** (a found bug is a class; sweep it to its
codebase-wide boundary). Cross-session memory updated with the open items. This session
swept every class — auth, rate-limiting, input-validation, §A18, false-ok writes,
quote-grounding, concurrency, migration-coupling, silent-mutation-failure — each fixed
or confirmed sound.

## Decisions waiting on you (each answerable in a sentence; fixes pre-written)
1. **talk-ratio / question-rate score** is raw magnitude, not quality (an over-talker
   shows 8/10). Invert the two, and re-baseline ELO? (It feeds the rating.)
2. **Company settings** are editable by any member (RLS-allowed; sensitive columns
   frozen). Gate to admin-only, or keep member-editable?
3. **Session-detail control gating** (the narrowed A2 §A18 question): `upload-recording`
   / `label-transcript` are reachable by a manager viewing a rep's session because
   `SessionRecordingUpload` is rendered ungated (`[id]/page.tsx:822`); and
   `LiveCoachingPanel` shows a "Start live coaching" control even on ended sessions.
   Should the live-coaching + upload controls be OWNER-only and (for the live panel)
   ACTIVE-session-only, leaving managers/ended-sessions the review tools? Fix ready
   (isOwner UI wrap + `agentId → 403` on the 2 routes + status-gate the live panel).

## Migrations to apply (founder — I can't verify applied-state headless)
This session added **`0098`** (team_invitations partial-unique index — dedup + no
duplicate pending invites). Also confirm these earlier §3.1-enforcement migrations are
applied, or the coded append-only protection isn't live: **`0085`**
(care_widget_load_events do-instead-nothing), **`0086`** (crm_activity_events same), and
whatever remained from the 2026-07-07 queue (`0095`/`0096`/`0097`). Verified this
session: the CORE §3.1 chain (events/decision_dialogues/etc.) is immutable via
do-instead-nothing rules; these are the peripheral tables whose enforcement migrations
may be pending. `npm run rls:audit` is green (all tables covered-or-documented).

## Retests I can't run headless
- The flags on your real sessions (see #1).
- A live call to confirm the 5 live-coaching cue fixes (stress speaker, empty-commit
  pace, triple-tap, sep-reset, stale-cue-after-restart) — logic + build verified, not
  runtime-verified.

Reply with a yes/no on any decision and I'll apply the pre-written fix immediately.
