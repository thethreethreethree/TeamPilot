# Session summary — 2026-07-09 (single entry point)

Everything built/fixed today, and the exact decisions + retests waiting on you.
Gate green throughout: tsc 0, lint 0, next build 0, **502 tests**. All committed + pushed (~56 commits).

---
## ⇒ WHAT NEEDS YOU (read this first; detail below)

**Product decisions — each a one-sentence answer, fix pre-written (see "Decisions waiting on you"):**
1. Talk-ratio/question-rate score: invert (raw magnitude → quality) + re-baseline ELO? [y/n]
2. Company settings: gate to admin-only, or keep member-editable? [admin-only / keep]
3. Session-detail upload/live-coaching controls: make owner-only + active-only? [y/n]
4. **Resolution review: event-source it (mirror `0015`) or keep write-once column?** ← load-bearing [event / column]

**Infra / ops decisions:**
5. CI-invariant protection: run `chain.integration.test.ts` in CI (one env-var step — fully closes the §5 gap)? [y/n]
6. Optional refactors flagged, your call: centralize coach event-kind consts; `vendor_config` table for the vendor id; de-dup `ELOSTATE_COMPANY_ID`.

**Scale-hardening — correct NOW, wrong at scale (schedule before you grow traffic; details in Findings):**
7. Rate limiting is in-memory per-instance (weak on serverless) → Redis/Upstash-backed. [needs store decision]
8. Readout/analytics layer truncates at PostgREST's 1000-row cap (8+ unbounded queries, care + asset readouts) → wrong metrics for a busy company → bounding pass (per-query limits or DB-side aggregation). [needs row-bound decision]

**Apply (I can't, headless):** migrations `0098`, `0099`; confirm `0085`/`0086`/`0095`–`0097` applied.
**Confirm in prod:** vendor company id is your real vendor + `0089` live; set server VAPID env vars.
**Retest:** flags on real sessions; a live call for the 5 cue fixes.

*Reply with any answer above and I'll apply the pre-written fix immediately.*

---

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
codebase-wide boundary) and **A27** (a false immutability label over a mutable write —
the resolutions/care write-once class). Cross-session memory updated with the open items.
This session swept every class — auth, rate-limiting, input-validation, §A18, false-ok
writes, quote-grounding, concurrency, migration-coupling, silent-mutation-failure — each
fixed or confirmed sound.

### 6. Also shipped (later this session — after the sections above)
- **Push 403-diagnosis aggregation** (`sender.ts`): the OPEN "subscribes but doesn't
  deliver" bug — the sender now logs ONE aggregated line naming the VAPID-keypair-mismatch
  cause + fix when sends 403. Logging-only; doesn't resolve it (still needs your VAPID env
  config + a triggered push), but the log now reads the answer instead of requiring inference.
- **Constitutional DB-invariants registry** (`docs/constitutional-db-invariants.md` +
  `supabase/migrations/README.md`): a code-verified, grep-anchored, COMPLETE list (22
  append-only tables, 5 freeze triggers, the gate trigger, definer search_path, vendor/authz
  guards) of every schema-enforced constitutional guarantee — the human-review defense for
  the CI-gap flagged above. Discoverable from the migrations README so authors hit the rule.
- **Flags disclosure-note accuracy fix** (`sessions/page.tsx`): the modal's §A18 honesty
  note under-described the flag's basis after the v2 broadening; now names all four (outcome,
  pivot, sentiment, breakdown). Kept the "does not use private scores" line.
- **Verified clean (no change):** §3.2 Understanding Gate (trigger enforces min-signals +
  distinct-sources + diagnosis-length, INSERT-bypass closed); §3.5 measurement honesty (every
  readout anchors to consequence, disclaims agreement); search_path across all 82 definer
  occurrences (0088/0089 close it); service-role cross-tenant across 27 routes.

## New: §1.7 audit extension — Coach v5 orphan-event documentation (migration 0099)
Extended the founder's own 0026 orphan-event audit (2026-06-12) to every event kind added
AFTER 0026 that fires into the §3.1 chain (`events` table) with ZERO signal_sources rows —
undocumented orphans with the exact "indistinguishable from accidental omission" legibility
problem 0026 exists to fix. **18 kinds** across SALES coach (14), COMMUNICATION coach
(message_graded / analyze_returned), the §3.4 CONTROL-CYCLE (control_skipped), and
mention.created. **§3.4 self-check catch (then A26-completed):** the first draft authored §4
questions from the kind NAMES (the §5 confident-quick-answer trap); a systematic re-check of
ALL 18 against verified emit semantics found **5 wrong** — message_graded + analyze_returned
(communication coach, not sales), debrief_generated (conversation coach, not sales),
control_skipped (the §3.4 control-cycle, not a UI cue), and after_pitch_summary (the
§A18-SAFE coarse-count event, wrongly framed as privacy-constrained). All corrected before
you'd apply it. `control_skipped` is now flagged as a likely ENABLED mapping (not deferral)
— skipping the month-1 control degrades attribution on every downstream measurement. Wrote **`0099`** adding an `enabled=FALSE` signal_sources row for each, with a real
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

## Verified: vendor authz company-id consistency (CRITICAL — the "confirm vendor company id" item)
Code-side confirmation of the 2026-07-07 vendor-CRM authz fix is DONE. The vendor company
id is byte-identical across all three enforcement points: the `0089` DB literal, `care/
config.ts:20`, and `crm/vendorAuth.ts:34` (`c3e7f389-…`). Route layer respects
`CARE_DEFAULT_TENANT_ID` (getVendorCompanyId / resolveCareTenant) — 0089's comment claim is
accurate (§3.4). **Still yours:** confirm the LIVE prod DB has 0089 applied AND that this id
is your actual vendor company's id in prod (I can only verify code/migration consistency,
not prod data).
**Route CLASS swept (A26), clean:** the CRITICAL bug pattern (a service-role route touching
vendor data gated on per-company isAdmin) has no surviving instance. All 7 `crm_*` tables
(incl. subscriptions/MRR/invoices) are reached ONLY via the `lib/crm/data.ts` chokepoint,
which is imported ONLY by the 6 `/admin/crm/*` routes, ALL gated on `requireVendorAdmin`.
Triple-layered: route gate + single data chokepoint + 0089 RLS. No leak path.

Two flagged observations (NOT changed — security-critical, §2/§5):
- **Env-override footgun (LOW, fails-closed):** the SQL function can't read env, so setting
  `CARE_DEFAULT_TENANT_ID` desyncs the DB layer from the route layer. Documented in 0089's
  comment; fails CLOSED (locks out, never exposes). A `vendor_config` table read by the
  function would remove the manual-sync requirement — structural, your call.
- **Duplicated security constant:** `ELOSTATE_COMPANY_ID` is hardcoded in care/config.ts AND
  vendorAuth.ts (identical now, no sync enforcement). One exported constant would prevent
  divergence of a CRITICAL-authz value. Small, but it's a security constant — your call on
  the module-dependency direction.

## Recommendation: the constitutional DB invariants aren't CI-verified (§5 structural gap)
This session independently re-verified the constitution's structural core is enforced-in-
schema and airtight TODAY: §3.1 immutability (do-instead-nothing rules on every chain
table), §3.2 Understanding Gate (`problems_understanding_gate` trigger — min-signals +
distinct-sources + diagnosis-length, fires on INSERT OR UPDATE so a direct-insert-as-
surfaced can't bypass it), §3.5 measurement honesty (every readout anchors to consequence,
disclaims agreement). **But nothing in CI verifies they STAY.** `npm run check` covers
tsc/lint/theme/rls-coverage/tests — NOT the DB triggers/rules that enforce these invariants.
A future migration that drops the gate trigger or an immutability rule would pass green while
silently removing a constitutional guarantee (the §5 "builder drops a protection under
pressure" risk, at the schema level). **Good news — the test already exists and is
comprehensive.** Verified 2026-07-09: `chain.integration.test.ts` has THREE env-gated blocks
that already assert all three invariant classes — §3.1 chain derivation (events→signals),
§3.2 gate (blocked without evidence / allowed at threshold), and §3.1 immutability (UPDATE +
DELETE are silent no-ops, tested on events AND signals independently so a drop of either
rule is caught). So the fix is PURE INFRA, no test-authoring: run this suite against a live
DB in CI (set `EXECOS_INTEGRATION_TEST=1` + `NEXT_PUBLIC_SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`). That single step fully closes the gap — it turns "the
invariants are verified today" into "the invariants are verified on every push." (The
alternative — a create/drop-order-aware check in `rls-audit.mjs` — carries a
false-positive-breaks-green risk I won't take autonomously and is unnecessary given the
integration suite already exists.)

## Finding: rate limiting is in-memory per-instance (best-effort on serverless)
Verified `src/lib/api/rateLimit.ts` — a correct in-memory sliding-window limiter, but the
`Map` is MODULE-LEVEL (per-instance). The code comment says so: "Sufficient for
single-instance; for horizontally-scaled, swap for Redis." On Vercel serverless (scales
horizontally under load), the cap is PER-INSTANCE, so it weakens precisely under an attack
(load → more instances → weaker effective limit). **Accurate posture:** AUTH is the hard
protection (an anon caller is blocked regardless — verified sound across the LLM/TTS/route
gates); the rate-limit is best-effort defense-in-depth, NOT a hard global cap on serverless.
**Where it matters most:** the token-gated customer-widget routes (`care/tts`, `care/.../upload`,
`care/.../messages`) — a valid-token customer's spam/cost there is bounded *primarily* by the
rate limit, which serverless weakens. **Low urgency now** (early-stage, low traffic, usually
one warm instance) but real at scale/under deliberate abuse. **Fix (known, your call):**
Redis/Upstash-backed rate limit (the code comment already names it) — a focused build I can
do on your word; it needs an operator decision (which store) + env config, so flagging not
building.

## Finding: PostgREST 1000-row truncation on unbounded child queries (analytics wrong at scale)
A26 sweep of the row-cap class I fixed in `getCueRelianceSeries` this session (silent 1000-row
default cap → undercounted metric). Found another instance: the **care cohort/durability
analytics** (`care.ts` ~1552) reads `support_messages` for the durability cohort's
conversations with NO `.limit()` — while its PARENT check query HAS `.limit(5000)`. So the
parent allows up to 5000 conversations but the child truncates their agent-messages at 1000;
conversations whose messages fall past the cap default to "ungraded" (line 1568), MIS-classifying
them → wrong v5/v6/ungraded durability cohort readout for a busy support desk. The limit was
applied to the parent but MISSED on the child (incomplete fix). **VERIFIED systematic (not
speculation):** the sibling care-analytics child queries all share it — care.ts:1719 (customer-
message medium breakdown), :1821 (co-pilot agent-message analytics), :2260 (durability-check
fan-out) all do `.in("conversation_id", conversationIds)` over the same parent-bounded-to-5000
set with NO `.limit()`, so each truncates at 1000. **assetReadout traced too (now confirmed):**
:108/:151 (file view/download/citation EVENTS — high fan-out per file) and :173/:208
(classification suggestions) all `.in()` over `fileIds` with no `.limit()`. So the class is
SWEPT to its boundary: **8 confirmed instances across both readout modules** (care analytics +
asset readout) — the readout layer systematically fans out into child queries without bounding
them. Worse in assetReadout: even the PARENT `files` list query (line 82) has no `.limit()`, so
`fileIds` itself caps at 1000 → a company with >1000 files builds its whole asset readout from
only the first 1000, then the child queries truncate again (double truncation). **Related (same
layer, distinct class):** these readout queries also use `const { data } = ...` and IGNORE the
`error` — so a query FAILURE returns empty → the readout silently shows zeros, indistinguishable
from "no activity" (the §3.4 live-error-vs-empty class, same one fixed in `salesElo`). **Bottom
line:** the readout/analytics layer needs a hardening pass covering BOTH bounding (parent lists +
child fan-outs) AND honest error handling (distinguish failure from empty). **Same profile as
rate-limit:** correct at current low volume, wrong/misleading at scale or on transient failure.
**Severity escalation (verified 2026-07-09):** the error-swallowing isn't just internal
analytics — `brain/learning-summary` (the §3.6 command-center metrics the founder reads to gauge
team health) swallows errors on EVERY query too (no `error` check anywhere). So a transient DB
failure makes the PRIMARY health dashboard show misleadingly-low activity/durability — "the team
did nothing" when it's a hiccup. That's the honest-error-state discipline the founder cares about
(§3.4) failing on the most-watched surface. Bumps the error-handling half from "internal polish"
to "user-facing correctness." Bounding is still low-urgency; honest-error-state deserves priority. **Fix (your call on the bound):** add an explicit `.limit()` +
truncation log (the `getCueRelianceSeries` pattern) or paginate the child analytics queries.
Low urgency now; a focused pass I can do on your word (needs a decision on the row bound).

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
