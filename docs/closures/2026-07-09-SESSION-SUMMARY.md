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
→ **Data-path VERIFIED (2026-07-09, A14):** traced emit→parse end-to-end — the queried
event kinds (session_pivot_generated / session_moments_generated), the payload shapes
(`{pivot:…}` / `{moments:[…]}`), and the field names (direction/whatHappened/whyItMattered;
sentiment/isBreakdown/kind) ALL match between the engines and extractSessionSignals. So the
wiring cannot silently fail the way v1 appeared to. If flags look sparse on retest, it's a
data-availability signal (sessions genuinely lack an outcome/analysis), NOT a wiring bug —
and the diagnostic log names which. This closes the AMD-006 L2 "does it actually work"
question at the integration layer, not just the unit layer.

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
- **§3.5 durability write-once class swept (A26)** — the resolution-review overwrite bug
  was a CLASS; swept all three §3.5-durability surfaces. Chat-topic review: verified
  CORRECT (event-sourced via 0015). Care support durability (`recordDurabilityOutcome`):
  had the SAME unguarded overwrite + false-ok (a re-POST silently overwrote held→reopened,
  always returned `{ok:true}`) → fixed (write-once `.is(checked_at,null)` guard + honest
  404/409 + POST company-context check). No UI caller yet, so forward-compatible.

### 5. Methodology + records
Captured ThinkerThinker.md **A26** (a found bug is a class; sweep it to its
codebase-wide boundary). Cross-session memory updated with the open items. This session
swept every class — auth, rate-limiting, input-validation, §A18, false-ok writes,
quote-grounding, concurrency, migration-coupling, silent-mutation-failure — each fixed
or confirmed sound.

## New: §1.7 audit extension — Coach v5 orphan-event documentation (migration 0099)
Extended the founder's own 0026 orphan-event audit (2026-06-12) to every event kind added
AFTER 0026 that fires into the §3.1 chain (`events` table) with ZERO signal_sources rows —
undocumented orphans with the exact "indistinguishable from accidental omission" legibility
problem 0026 exists to fix. **18 kinds** across SALES coach (14), COMMUNICATION coach
(message_graded / analyze_returned), the §3.4 CONTROL-CYCLE (control_skipped), and
mention.created. **§3.4 self-check catch:** a first draft mislabeled the two communication-
coach kinds + control_skipped as sales-live-telemetry FROM THEIR NAMES (the §5 confident-
quick-answer trap) and fabricated three wrong §4 questions; caught + corrected against the
verified emit semantics before you'd apply it. `control_skipped` is now flagged as a likely
ENABLED mapping (not deferral) — skipping the month-1 control degrades attribution on every
downstream measurement. Wrote **`0099`** adding an `enabled=FALSE` signal_sources row for each, with a real
§4 consequence question (A4 discipline — no vague filler), following 0026's pattern exactly.
- **Zero behavior change** (enabled=false → no signal derived); the value is chain legibility.
- **§4 questions are DRAFTED** from each event's purpose + the constitution's framing (§3.5
  consequence, §A11 mirror, §A18 owner-privacy, §3.3 guide-don't-overtake). Edit any before
  applying if the intended question differs — applying as-is is safe.
- **Answers Checklist #9** (last ground-up audit + open flags) for the newest subsystem.
- **Comprehensive:** the same sweep checked EVERY namespace emitting into `events`
  (asset.*, decision.*, mention.*). asset.* + decision.* are already documented; the only
  other undocumented orphan was `mention.created` (folded into 0099). So 0099 closes the
  WHOLE post-0026 orphan set, not just coach — the §1.7 orphan audit is now current.
- **Founder action:** review the drafted §4 questions, then apply 0099 (idempotent — on
  conflict do nothing). This is the §1.7 legibility fix, not a functional one.

## Verified clean this session (no action needed — recorded for confidence)
- **Coach event-kind wiring (A14, whole surface).** Diffed EVERY queried `coach.*`
  event kind against every emitter across the app: all match. No manager-facing coach
  badge/metric is silently broken by a kind mismatch (the §3.5 honest-measurement risk).
  *Recommendation (not built — a broad no-behavior-change refactor is review burden you
  didn't ask for):* the kinds are declared two ways — shared named consts in the `why` /
  `why_patterns` engines (desync-PROOF) vs bare string literals in the list + analytics
  routes (desync-RISK on a future rename). Centralizing all ~15 into one consts module,
  following the why-engine precedent, would kill the mismatch class structurally. One word
  and I'll do it.

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
4. **Resolution review — write-once column vs appended event** (§3.1 architecture).
   FIXED the immediate defect this session (a68ce70): the review UI promised "you don't
   edit prior reviews" but the API had no write-once guard and did an in-place UPDATE —
   any same-company caller could silently overwrite `durability` (the §3.5 metric). Now
   enforced write-once (409 on re-review) + label corrected + a conscious durability
   choice required (was defaulting to "unknown", a hasty-Save footgun under write-once).
   **Your decision — the deeper one I did NOT make:** the review is still stored as a
   *mutable-once column*, not an appended event. A genuine §3.1 reading says the measured
   consequence should be an **event** in the immutable chain (so durability-over-time is
   replayable, and the review joins `events → signals → problems → resolutions → events`
   properly). **There's already a working precedent in your own codebase:** the chat-topic
   durability review does exactly this — migration `0015`'s `chat_topics_durability_review_trigger`
   fires a `chat.topic_durability_reviewed` event (with both new + previous value) on every
   `close_durability` change, so its column is just a denormalized "current" while the event
   log holds full history. Resolutions is the only one of the three §3.5-durability surfaces
   that DOESN'T. Want me to mirror 0015 (emit `resolution.reviewed` on review), or is
   write-once-column the intended denormalization? One sentence and I'll build it.
   **Verified nuance (2026-07-09):** the `check_resolution_immutability` trigger (0005:50-68)
   freezes action_taken/reasoning/decided_at but EXPLICITLY allows durability/observed_outcome
   to change — it does not restrict to once. So my app-level write-once guard (a68ce70) is the
   ONLY enforcement; a direct service-role/PostgREST write could still overwrite durability
   because the DB permits it. The 0015 event-sourcing approach is more robust precisely here:
   it captures every change immutably regardless of write path, so even a DB-level correction
   is preserved in history rather than lost. If you pick event-sourcing, I'd also add a
   once-only DB guard (or emit-on-change) so the §3.5 metric is defended below the app layer.

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
