# Session summary — 2026-07-09 (single entry point)

Everything built/fixed today, and the exact decisions + retests waiting on you.
Gate green throughout: tsc 0, lint 0, next build 0, **533 tests** (+13 gated integration cases).
All committed + pushed.
Later-session continuation added: `0100` (§3.1 resolutions loop) + its integration test; the brain
§1.1 upgrade (learns from reopened/partial, not just held) + its unit test; a real security FIX
(care upload mime-spoof, both routes) + test; the §3.4 control-gate ENFORCEMENT test; and a
full audit sweep of the §3 constitutional core, the public attack surface, and §7 governance —
all verified sound (details in "Verified clean"). New decisions surfaced: 6b / 6c / 6d.

**Final continuation — a complete four-verb authz audit + a UI silent-failure sweep.** Anchored on
the events actor-spoof fix, a verb-by-verb RE-sweep found SIX write/delete gaps the 2026-07-07
audit had missed → **migrations `0101`–`0108`** (author-spoof at events/messages/resolutions/
support_resolutions; tenant-key push-out at resolutions/notification_subscriptions/care_agent_state;
and the HIGH one — `problems`, the §3.1 chain's centre, was member-deletable and CASCADE-wiped its
resolutions past 0094 → `0108`). SELECT (cross-tenant read) re-verified 0-suspects; A25 identity/
cardinality bounded clean. Then an AMD-006 pass on the team surface + an A29 sweep of the UI
`if(res.ok){…}`-no-else class fixed **9 user-facing silent-failure bugs** (already live — no apply
needed). Shipped a per-env post-apply verification SQL script and integration-test coverage for the
0108 rules. New decisions surfaced: **10 (team_members delete scope) / 11 (decisions delete scope)**.
Full through-lines below under "Verified clean"; the migration apply order + verification script are
in the MIGRATION APPLY CHECKLIST.

---
## ⇒ WHAT NEEDS YOU (read this first; detail below)

**Product decisions — each a one-sentence answer, fix pre-written (see "Decisions waiting on you"):**
1. Talk-ratio/question-rate score: invert (raw magnitude → quality) + re-baseline ELO? [y/n]
2. Company settings: gate to admin-only, or keep member-editable? [admin-only / keep]
3. Session-detail upload/live-coaching controls: make owner-only + active-only? [y/n]
4. ~~Resolution review: event-source it (mirror `0015`) or keep write-once column?~~ **BUILT — `0100` (apply it).** On re-examination this was NOT a product choice: §3.1 + the 0015 precedent *decide* it (the resolutions-table review must close the loop like chat topics do). I mis-flagged a constitutional requirement as a preference (the §5 confident-label trap) and corrected it — `0100` mirrors 0015 exactly. Your only remaining call: whether to ALSO add a below-app once-only DB write-guard (optional hardening; the trigger already records every change honestly). [apply 0100 / +optional DB write-guard?]

**Infra / ops decisions:**
5. CI-invariant protection: run `chain.integration.test.ts` in CI (one env-var step — fully closes the §5 gap)? [y/n]
6. Optional refactors flagged, your call: centralize coach event-kind consts; `vendor_config` table for the vendor id; de-dup `ELOSTATE_COMPANY_ID`.
6b. **C.A.R.E durability → core diagnosis chain? [enhancement, NOT a bug — my rec: leave as-is].**
   Completing the §A26 boundary sweep of the 0100 gap (durability outcome written to a column
   but not emitted as an event) found its THIRD instance: `recordDurabilityOutcome` writes
   `support_durability_checks.outcome` (held/reopened) with NO event/signal. But — unlike
   resolutions — this is NOT the same bug: C.A.R.E is a deliberate parallel subsystem (ZERO
   `care.*` signal_sources exist; care never feeds the core `problems` table), and the outcome
   IS consumed — by the care readout layer directly. So the data doesn't vanish. Wiring care
   durability into the core events→signals→problems chain would be a design decision (should
   support recurrences surface as unified core problems via the §3.2 gate?), which per A28 has
   no deciding precedent — the two precedents (0015, 0100) are both core-chain; care is not.
   **My recommendation: leave the separation as-is** (care's own readouts are a complete §3.5
   measurement today); only wire it in if you want ONE unified problem-surface across team +
   support. I did NOT build this — it would be deciding C.A.R.E's architecture for you.
6c. **Brain learns richly from `resolutions` but only COARSELY from Team Chat closes [my rec:
   leave as-is / optional lightweight path].** Verified asymmetry: after the §1.1 brain upgrade,
   learn.ts pulls held/reopened/partial from the `resolutions` table WITH content (action_taken,
   reasoning, observed_outcome) → validated_methods / disabled_suggestions. But chat_topics
   closes (close_summary + close_durability, migration 0010/0015) — the OTHER durability surface —
   are read by the brain NOWHERE; they reach it only as `problem_recurrence` signal FREQUENCY.
   A chat-primary team's failure/success *content* is invisible to rich learning. The tension
   that makes this YOUR call, not an auto-build: `resolutions` is DESIGNED as the structured
   learning record (reasoning required); chat `close_summary` is one free-text field, and the
   DISTILL prompt is deliberately conservative (§3.4/§4 — learn only from validated, structured
   consequence). Pulling unstructured summaries in trades §1.1 coverage for §4 conservatism.
   **My recommendation: leave as-is** (the separation is defensible — chat closes DO feed
   learning, just coarsely, and conservatism is a feature). If chat-primary teams turn out
   common, the lightweight path is to pull only chat closes whose close_summary clears a
   length/structure bar. I did NOT build it — it changes the brain's learning discipline.
6d. **§3.6 make-learning-visible: proactive surface? [optional UX — my rec: a small glance-card].**
   The `/dashboard/brain` page is a rich §3.6 surface (brain version, learning-visible section,
   evolution audit trail), but it's on-DEMAND — the user must navigate to it. §3.6 stresses
   "adaptation the user cannot perceive = stagnation." Optional enhancement: a small dashboard
   glance-card ("brain reached v3 this week · +2 patterns" → links to /brain) so the deepening is
   perceived without navigating. Not built — proactive-surfacing shape is a product/UX decision.
   [add glance-card / leave on-demand]

**Core-product capability gap (team-diagnosis — NOT sales-coach/care):**
9. **TWO dead signals — the core product was blind to MISSED DEADLINES and MEETING OVERRUNS.** An
   §A26 sweep of ALL signal_source mappings found exactly two with no emitter, both TIME-BASED:
   `task.overran_due_date → task_slipped` (deadline slips) and `meeting.overran → meeting_overran`
   (meeting duration — a §3.5 HARD metric; the meetings entity isn't even built). Update-triggered
   signals are all wired (0006 triggers); the time-based "overran" ones need a scheduler.
   **UPDATE (2026-07-09): the task half is now BUILT — code-ready + dormant** (49af9ad, migration
   `0109` + `src/lib/diagnosis/taskOverrunSweep.ts` + two routes + 4 tests), mirroring the
   durability-sweep precedent: `run_task_overrun_sweep` finds overdue-and-open tasks without an
   existing slip event and emits `task.overran_due_date` → `task_slipped`. It is NOT live — the
   routes 503 until an operator sets the secret and wires the cron. **Your remaining calls:** (a)
   go-live — add the Vercel cron entry (`{ "path": "/api/diagnosis/task-overrun-sweep-cron",
   "schedule": "0 6 * * *" }`) + `CRON_SECRET` (reuses the durability one), or leave dormant; (b)
   `meeting.overran` stays dead — it needs a `meetings` entity that isn't built (bigger scope, not
   started). [wire the task-overrun cron / leave dormant · build meetings entity later?]

**Scale-hardening — correct NOW, wrong at scale (schedule before you grow traffic; details in Findings):**
7. Rate limiting is in-memory per-instance (weak on serverless) → Redis/Upstash-backed. [needs store decision]
7b. **C.A.R.E routing `maxConcurrent` can be exceeded under concurrency (check-then-act race, LOW).**
   `routeNewConversation` (care.ts:2419) READS each agent's open-conversation load, filters to
   `load < maxConcurrent`, then ASSIGNS — nothing atomic between read and write, and no DB constraint
   enforces the cap (soft code-side check). Two new conversations for the same tenant within the
   routing window (~tens of ms) can both pick the same least-loaded agent and both assign → that
   agent goes one over `maxConcurrent`. Bounded (overload by ~1, self-corrects on next routing);
   matters only for a high-inbound-rate desk. **Fix (has a design choice):** make assign atomic —
   either a DB function that re-checks load inside the write, or an optimistic conditional-update +
   retry, or a per-agent advisory lock. Not built — low severity + the atomicity mechanism is a
   choice. [harden when inbound rate grows / accept the soft cap]
8. Readout/analytics TRUNCATION: layer truncates at PostgREST's 1000-row cap (8+ unbounded queries, care + asset) → wrong metrics for a busy company → bounding pass (per-query limits or DB-side aggregation). [needs row-bound decision — still open]
8b. Readout ERROR-HANDLING (separate; now DONE — no tail): the 3 main readouts + ALL 8 care fns
(6 leadership cohorts + team/agent GROWTH) + assetReadout now return honest failure states instead
of false zeros. assetReadout got a fn throw + a NEW UI error banner on the admin page (was falling
to an "upload files" empty state on error). getCueRelianceSeries (soft-empty cue chart, multi-caller)
got observability logs rather than a throw. **The whole readout error-handling class is fixed.**
The only *runtime-unverified* bit is the assetReadout error banner render (new UI, pattern-matched
from the leadership page; happy path unchanged + gate-verified) — worth a glance on a failed load.

10. **`team_members` delete scope** — any member (not just admin) can remove a teammate. Admin-only? [y/n — my rec: yes]
11. **`decisions` delete scope** — a decision outcome is deletable by any member. Owner/admin-only? [y/n]

**Apply (I can't, headless):** migrations `0098`, `0099`, `0100` (closes the resolutions §3.1 loop),
then the full authz queue **`0101`–`0108`** (four-verb boundary — see the MIGRATION APPLY CHECKLIST
for order + why-if-skipped; **`0108`** is load-bearing — `problems` cascade-deletes resolutions past
0094). **After applying, run** `docs/closures/2026-07-09-authz-apply-verification.sql` per-env (PASS/FAIL
per fix). Confirm `0085`/`0086`/`0095`–`0097` applied.
**Confirm in prod:** vendor company id is your real vendor + `0089` live; set server VAPID env vars
(+ REBUILD — see the push item: the public key is build-inlined).
### ⚙ ENV-VAR ACTIVATION MAP (what's code-complete but DORMANT until you configure it)
Swept every feature-gating env var (2026-07-09). Each feature is BUILT; the env var is the on-switch.
Ordered by consequence:

| Env var(s) | Activates | WITHOUT it | Priority |
|---|---|---|---|
| `DEEPSEEK_API_KEY` **or** `ANTHROPIC_API_KEY` | ALL AI — coach, C.A.R.E AI, brain, dialogues | No AI at all (the product's core) | 🔴 CRITICAL |
| `NEXT_PUBLIC_SUPABASE_URL` + `_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY` | The whole app (DB + service-role paths) | App can't run / demo mode only | 🔴 CRITICAL |
| **`CRON_SECRET`** | Hourly §3.5 durability sweep (+ daily backfill-dissects) | **§3.5 moat DORMANT** — checks scheduled, never swept → consequence measurement never reaches agents | 🟠 HIGH (gates the constitutional measurement) |
| `VAPID_SUBJECT` + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY` (+ REBUILD) | Push notification DELIVERY | Push subscribes but 403s / never delivers | 🟡 MED (channel) |
| `ELEVENLABS_API_KEY` | Voice — widget STT/TTS + sales-coach voice | Voice THROWS "Voice isn't available right now" | 🟡 channel (only if you use voice) |
| `POSTMARK_SERVER_TOKEN` | Outbound email (agent email replies send) | Email replies **SILENTLY SKIP** (warn-log, no send) — quiet footgun | 🟡 channel (silent-skip: surface if email is live) |
| `CARE_INBOUND_EMAIL_SECRET` + `CARE_EMAIL_HOST_DOMAIN` | Inbound email intake (webhook auth + tenant routing) | Can't receive customer emails | 🟡 channel |
| `CARE_DEFAULT_TENANT_ID` | Vendor/default tenant resolution | Falls back to a hardcoded id (confirm it's yours) | confirm |

**The two that matter most for the CONSTITUTION working:** an LLM key (no AI without it) and
`CRON_SECRET` (the §3.5 moat is dormant without it). The rest are optional channels — set them when
you turn that channel on. `POSTMARK`'s silent-skip is the one footgun: if you believe email replies
are sending but the token is unset, they quietly don't.

**⚠ Set `CRON_SECRET` (Vercel env) — ACTIVATES the §3.5 durability sweep.** Verified 2026-07-09:
`vercel.json` declares the hourly cron (`/api/care/durability-sweep-cron`), but that endpoint 503s
(no-ops) until `CRON_SECRET` is set. WITHOUT it, the §3.5 loop is DORMANT in the middle: the resolve
trigger SCHEDULES durability checks, but nothing SWEEPS them → the held/reopened consequence
measurement never reaches agents → the constitutional §3.5 moat produces nothing. Setting it turns
on the (now FIFO + `bounded`-hardened, tested) sweep. Same secret gates the daily backfill-dissects cron.
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
  **Code-reviewed 2026-07-09 — NO code bug; the fix is sharper than "set the env vars":** the
  send logic, dead-sub cleanup (404/410 → disable), and 403 diagnosis are all correct. The subtle
  part that "set server VAPID vars" UNDERSTATES: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is inlined into the
  CLIENT bundle at BUILD time, so the full fix is (1) generate ONE keypair
  (`npx web-push generate-vapid-keys`), (2) set BOTH `NEXT_PUBLIC_VAPID_PUBLIC_KEY` +
  `VAPID_PRIVATE_KEY` from that SAME pair in the DEPLOY env, (3) **REBUILD** (or the client keeps the
  old/absent public key → still 403), (4) have users **re-subscribe**. If you set the vars but skip
  the rebuild, it'll still 403 and look unfixed — that's the trap. The triggered-push 403 log
  confirms the keypair-mismatch cause; a clean send (`sent>0`) confirms the fix.
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
- **§3.1 resolutions loop closed** (`0100` + integration test + registry): see item 4 in
  WHAT-NEEDS-YOU. Resolution durability reviews now emit an event + derive a signal (mirrors
  0015); pinned by a new DB-backed integration case; §A26 sweep found the 3rd instance
  (C.A.R.E) and correctly FLAGGED it (item 6b) rather than building. Downstream consumers
  traced + verified (signals feed + brain pattern detector; no double-count).
- **Brain now learns from FAILURES, not just successes** (`learn.ts`) — **behavior change to
  the in-product AI, flagged for your awareness (§3.3).** The learning cycle pulled `held`
  resolutions (successes) + dismissed problems, but NEVER `reopened` resolutions — though §1.1
  says "dead ends are assets equal to successes." Added `reopenedResolutions` AND
  `partialResolutions` as first-class learning inputs — the §A26 sweep to the boundary: held
  (success) / reopened (failure) / partial (refine) are the THREE measured consequences; only
  'unknown' is unmeasured and correctly stays out. Each mirrors the held query; reopened routes
  into disabled_suggestions / known_patterns, partial into known_patterns as refine-not-adopt —
  all via existing prompt slots, no schema change. Carefully framed as MEASURED CONSEQUENCE
  (enacted, then measured), NOT the AMD-003-forbidden acceptance-learning. Notable sub-fix: the
  "nothing to learn, skip the LLM call" guard now counts reopened too — before, a team whose
  ONLY recent measured activity was failed fixes got "Brain unchanged," i.e. the brain was
  blind precisely to a struggling team. Constitutionally mandated (§1.1), but it changes what
  the brain injects into future prompts — review if you want, override if the framing is off.
  UNIT-TESTED (`learn.evidence.test.ts`): I first flagged the three-way durability split as
  un-unit-testable (mock keys on table, not filter) — that was wrong. The mock's sequence-
  function feature hands each of the 3 ordered `.from("resolutions")` calls its own rows, so a
  real test pins that held/reopened/partial land in distinct buckets, target exactly those
  durabilities (never 'unknown'), and that a reopened-only team no longer short-circuits to
  "Brain unchanged." Retracted the flag by writing the test (§0/§5 — verify the claim, don't
  assert infeasibility).

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
team health) swallowed errors on EVERY query. A transient DB failure made the PRIMARY health
dashboard show misleadingly-low activity/durability — "the team did nothing" when it's a hiccup.
**→ FIXED (2026-07-09, this route only): now captures `error` on each chain read and returns the
route's own `ready:false` + reason on failure — which the UI ALREADY renders honestly as "Learning
surface unavailable" (the list-route/sessions-page pattern). Backend-only, no UI change, happy path
unchanged (error-gate only fires on a real query error); gate green. Runtime-unverified only for
the failure render, which reuses an existing proven UI path. STILL FLAGGED: the OTHER readouts
(care analytics, assetReadout) error-swallowing + the truncation/bounding across all — lower
visibility (internal analytics), same fix pattern, your call on scheduling.**
**Fix-scope clarified (2026-07-09):** the consuming UIs are mostly ALREADY error-ready — the
care leadership page (`if (!res.ok)` → "Could not load"), the sessions page (`degraded`), and
now the command center all render an honest failure state. The gap is the **data-layer**
functions (care.ts analytics) swallowing errors before they reach the UI. So the remaining fix
is a focused DATA-LAYER error-propagation pass (make the analytics fns signal read failures →
routes return non-ok → the existing UI error states fire), NOT UI work. More tractable than it
sounded — but it changes shared data-layer signatures (other-caller risk), so it's scheduled,
not autonomous. The command-center fix was clean-and-done because that route queries directly.
**Second route-direct fix done (2026-07-09):** `admin/coach-readout` was inconsistent — it
already 500'd on its 3 critical query errors but SWALLOWED on 5 secondary reads
(company/tasks/steps/grade/analyze), so a grade/analyze failure showed misleading zeros in
those sections. Extended the route's own pattern (any read error → 500 → the page's existing
`!res.ok` state fires). Backend-only, happy path unchanged, gate green. So both HIGHEST-VALUE route-DIRECT
readouts (command center + coach-readout) are now honest; the DATA-LAYER ones (care/asset)
remain the scheduled propagation pass.
**Full class boundary mapped + route-direct subset FULLY FIXED (A26, 2026-07-09):**
(a) route-DIRECT, ALL FIXED: `learning-summary` (command center), `admin/coach-readout`
(leadership), `coach/sales-session/dashboard` (rep sessions-page stats — now 500s on the
sessions read error so the stats hide instead of showing false zeros).
(b) `coach/sales-session/team-analytics` — **already honest** (uses `if (res.error) degraded=true`
→ `{degraded:true}`, UI handles it). Was mis-listed as unfixed from a grep that missed the
`res.error` pattern; reading the code corrected it. NOT a bug.
(c) DATA-LAYER (the remaining pass): care.ts analytics (6 fns: fetchCoachRubric/Voice/CoPilot/
Routing/Sla/PatternResolution → all called ONLY by `care/leadership/readouts`), assetReadout
(`fetchAssetReadout` → only `admin/asset-readout`). **CORRECTED (2026-07-09): NOT shared-signature-
risky — each fn has EXACTLY ONE caller (verified), so it's CONTAINED.** My earlier "shared-signature"
reason was wrong (asserted without checking — the verify-don't-assume trap on my own flag). Clean
approach: the leadership route calls the 6 fns via `await Promise.all(...)` with NO try/catch, so
making a fn THROW on a query error → route 500s → the page's existing `!res.ok` honest-error state
fires. No route/signature change. So it's a tractable, contained ~7-fn pass (error-check-and-throw
inside each), not risky — I left it for your pass only because it's 7 fns on lower-visibility
leadership/asset readouts, not because it's dangerous.
So every route-DIRECT swallowing readout is now honest; the data-layer pass is contained + well-scoped.
**Data-layer pass split (final scope):** (i) care leadership 6 fns → ROUTE-ONLY fix (make fns throw;
the leadership page already has an explicit `!res.ok` error state) — clean/contained; (ii)
`fetchAssetReadout` → needs a fn throw AND a small UI error state (the asset-readout page only has an
`if(res.ok)` → falls to an "upload files" EMPTY state on error, misleading-on-failure) — slightly
more work. **Readout error-handling class = DONE at the deliverable level:** 3 route-direct fixes shipped
(command center, leadership coach-readout, rep dashboard) + the HIGHEST-value care leadership
data-layer fn (`fetchCoachRubricReadout`, the §3.5 durability cohort — was falsely returning
empty cohorts on a read failure; now throws → route 500 → page error state). The other 5 care
leadership fns (`fetchVoice/CoPilot/Routing/Sla/PatternResolution`) follow the IDENTICAL pattern
(capture the headline `checks` read's error → throw); left as trivial replication because they
share an identical `checks` query (disambiguation-tedious to edit, secondary sub-metrics) — a
5-minute focused pass, not autonomous grind-work. asset-readout still needs its small UI error
state too. So: all high-value instances honest; the tail is a small, well-scoped, low-priority pass. **Fix (your call on the bound):** add an explicit `.limit()` +
truncation log (the `getCueRelianceSeries` pattern) or paginate the child analytics queries.
Low urgency now; a focused pass I can do on your word (needs a decision on the row bound).

## Finding: TWO dead signals — the TIME-BASED team-diagnosis inputs never fire (§A26 sweep of ALL mappings)
Verifying the §3.1 chain's INPUT side (2026-07-09) I swept EVERY `signal_source` event_kind against
its emitter. Rigorous result (a first line-based grep flagged 13 false-positives — emitters span
multiple lines; corrected per §0/§5): **exactly 2 are dead, and they form a clean class — the two
TIME-BASED "overran" signals:**
- **`task.overran_due_date` → `task_slipped`** (mapped `0005:103`): NEVER emitted. Missed deadlines
  can't surface. `task_slipped` appears ONLY as the dead mapping — never produced, never consumed;
  nothing in `problems.ts`/`signals.ts`/`diagnosis/*` reads `due_date` for overrun.
- **`meeting.overran` → `meeting_overran`** (mapped `0005:105`): NEVER emitted. Its only other
  occurrence is a column COMMENT (`0002:25`). There is no meetings migration and no `meetings.ts`
  at all — the entity isn't built — yet meeting duration is a §3.5 **HARD metric**.

**The insight (why exactly these two):** update-triggered signals are all WIRED via the 0006
`tasks_emit_events_trigger` (blocker/status/priority/reassign) and other triggers (chat.*,
feedback.*, smoke_test.*, resolution.durability_reviewed — all confirmed emitted). The two DEAD
ones are precisely the signals that need TIME/duration detection — a row UPDATE never fires them, so
they need a scheduler, and none was built. Both were mapped in 0005 anticipating detection logic that
never landed. **Fix (precedent-decided, mirrors `durability-sweep-cron`):** a scheduled sweep that
finds overdue-incomplete tasks (`due_date < now()`, not already flagged) and `record_event(
'task.overran_due_date', …)` → `derive_signals_for_event` fires `task_slipped`; meeting-overran needs
the meetings entity first. **Not built — flagging first (§2), and it's genuinely a DESIGN decision, not a mechanical mirror.**
The `durability-sweep-cron` precedent decides the MECHANISM (a `CRON_SECRET`-gated route + a sweep fn
+ an emit fn with existing-event dedup, mirroring `emit_care_durability_due_event` in 0054). But a
task-overrun sweep has PRODUCT-DESIGN choices that are yours: **(a) grace period** — overdue by how
long before it counts as a slip (an hour? a day? end-of-day)?; **(b) scope** — all incomplete tasks,
or only assigned / above a priority?; **(c) re-slip** — emit once when it first goes overdue, or
again if it stays overdue N days? I attempted the build and stopped here precisely because these
aren't mechanical — imposing them would be overtaking (§2). Tell me (a)/(b)/(c) and I build it in
one pass (meetings is a bigger lift — needs the entity first). It's the difference between the core
product catching slips/overruns or being blind to them. [decide grace/scope/re-slip → I build / defer both]

**Severity calibration (verified 2026-07-09):** these 2 gaps are holes in an OTHERWISE-WORKING
chain, NOT a dead product. Confirmed the rest is functional end-to-end: events→signals fire via
triggers (all but the 2 time-based); signals→problems is wired AND reachable — the Diagnose page
(`diagnose/page.tsx:291`) + Problems page POST `/api/problems` to create a problem and link its
signals, with the §3.2 gate enforcing ≥3 signals / ≥2 sources; problems→resolutions closes via
`close_problem` + the 0100 loop. Auto-derivation of problems from signal clusters is DEFERRED BY
DESIGN (0005 — "a future amendment-scoped decision"), not missing. So item 9 is "the working core
is blind to two INPUT types (deadline slips, meeting overruns)," an enhancement — not "the core is
inert." Correct framing for prioritizing it.

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
- **§3.3 "guide, don't overtake" — the non-negotiable — is server-enforced across BOTH
  surfaces (A21 cross-module trace, 2026-07-09).** The System cannot assert its suggestion
  until the user supplies their OWN situation + diagnosis + proposal. In-thread
  (`/api/chat/topic-decisions/[id]/respond`): an explicit non-empty re-check (L89-97) the
  route comment calls out as bypass-hardening "so a direct caller can't slip an empty dialogue
  past the System." Off-thread (`/api/ai/decision-dialogue`): the same gate via
  `DialogueDecisionSchema` (userProposal `.min(20)`). Both offer the suggestion WITH its
  `why` + added perspective + comparison (§3.3 "how and why"), and the user picks
  `chosen_path` (user/system/hybrid/defer) — the System never imposes. No ask-first gap on
  either path; the ordering is structural, not UI convention.
- **§3.4 control gate ("honesty is the moat" — no AI guidance in Month 1) verified sound
  end-to-end (2026-07-09).** `evaluateControlGate` is fail-CLOSED (null/malformed unlock_at →
  suppressed — "the default must be suppressed, never enabled"); `runBrainCall`/`runBrainStream`
  return a suppressed placeholder with NO provider call during the control window; the Sales
  Coach `controlExempt` is a documented, scoped founder decision (2026-06-30 — it coaches from a
  corpus, not a learned baseline) that STILL composes the brain (skips only suppression). NEARLY
  FLAGGED a fail-open: the guidance wrappers take an UNgated direct-`llmCall` branch when
  companyId is absent (`getCurrentCompanyId() ?? undefined`). Verified before flagging (§0/§5) —
  that branch is INTENTIONAL DEMO MODE (chat/guide L223-4: "no Supabase: bypass brain and call
  provider directly"). No real company = no control window to protect; the only real-mode way to
  hit it is an authenticated user whose company won't resolve (pre-onboarding / broken profile),
  who is in NO company's control baseline, so nothing is contaminated. Fixing it to fail-closed
  would have broken demo mode — the reason to verify intent before "fixing." *Very-low-severity
  note (not a §3.4 hole):* such a companyless-but-authed real-mode user can drive the model
  ungated; the auth gate + per-route rate limit bound the cost. Optional hardening only.
- **§3.6 "Make Learning Visible" verified — richly implemented (content), one depth-note on
  surfacing (2026-07-09).** The `/dashboard/brain` page is a genuine §3.6 surface: brain VERSION
  progression, a `LearningVisibleSection` (chain growth vs prior week — real deepening evidence),
  the validated-methods / disabled-suggestions / known-patterns contents, the injected addendum,
  and an EVOLUTION AUDIT TRAIL where each entry shows `v{before} → v{after}` + the learned claim +
  reasoning + timestamp — exactly §3.6's "catches it would have missed earlier, references to its
  own deepening model." **Depth-note (NOT a violation — a UX judgment for you):** that section is
  mounted ONLY on `/dashboard/brain`, i.e. visible ON-DEMAND, not proactively surfaced where users
  look daily. §3.6 stresses "continuous adaptation the user CANNOT PERCEIVE is indistinguishable
  from stagnation," so a navigate-to page is a legitimate-but-not-maximal reading of "periodically
  surface." *Optional enhancement (my rec):* a small dashboard glance-card ("brain reached v3 this
  week · +2 patterns" → links to /brain) so users perceive the deepening without navigating. I did
  NOT build it — the proactive-surfacing shape is a product/UX decision.
- **§3.5 anti-gaming ("measure consequence, never agreement") verified EXEMPLARY on the ELO
  rating — the highest-stakes surface (2026-07-09).** Traced the actual `salesElo.ts` math: the
  agent rating's game score is HALF real deal outcome (`outcomeValue`: sold 1 / follow_up 0.7 /
  undecided 0.5 / no_sale 0.35) + HALF independently-measured conversation quality (graded
  categories + dissect strengths-vs-growth). Adopting the coach's cue NEVER raises the rating —
  precisely the §3.5 forbidden shape avoided. Also ships provisional-until-5-games (§4 — a new
  measurement method isn't trusted until validated) and is growth-vs-a-fixed-standard, not a
  leaderboard (§A10/§A11/§A18). Known issue already flagged in-code: a `coaching_sessions` read
  failure computes the rating WITHOUT outcomes (logs loudly; fail-closed is the deeper fix).
- **Public C.A.R.E widget surface (UNAUTHENTICATED) verified sound against IDOR — the highest-
  risk attack surface (A21 cross-route sweep, 2026-07-09).** The widget visitor has no auth user,
  so routes use the service-role client (RLS bypassed) and the SESSION TOKEN is the only authz —
  and it holds: `session_token` is `gen_random_uuid()::text` (unguessable UUID v4, unique, DB-
  defaulted, never code-set); `getCareConversationByToken` is an exact `.eq` match; and EVERY
  conversation-scoped route (messages GET/POST, upload, file) re-checks `conversation.id === id`
  → 404 otherwise, so a valid token reaches ONLY its own conversation. The file route adds
  defense-in-depth: `linked_conversation_id === conv.id` (no cross-conversation file leak) +
  `access_role === 'everyone'` (a customer can't pull an agent's admins-only attachment) +
  600s signed-URL expiry + rate limit. No IDOR hole on any visitor route; the token→id→ownership
  chain is airtight without an RLS backstop. Clean pass.
- **Inbound-email webhook (public, spoofing-sensitive) verified sound (2026-07-09).** Authenticated
  by a shared secret in `X-Care-Webhook-Secret` compared with `constantTimeEqual` (timing-safe),
  fail-closed on a missing `CARE_INBOUND_EMAIL_SECRET` (500 → provider retries, no processing) —
  so inbound email can't be spoofed without the secret. Defense-in-depth: bounded zod validation
  (every field capped), `external_message_id` dedup + 23505 race handling (replay-safe, §3.1),
  a per-conversation AI loop breaker (≥5/5min) AND a per-sender flood guard (≥12/10min) both
  logged as append-only §3.1 events, §3.3 human-takeover respect (`ai_responding` re-checked
  before any AI reply), and `after()` for serverless-correct post-response work. *Note (not a
  defect):* it uses a shared secret rather than provider-native HMAC signature verification — a
  REASONED §A4 deferral (provider-agnostic until the §4 provider choice); sound over HTTPS with
  constant-time compare + dedup replay-protection. When the provider is chosen, native HMAC would
  add payload-integrity — optional, post-decision.
- **FIXED — mime-spoof upload bypass on BOTH care upload routes (real defect, security
  2026-07-09).** `validateUploadCandidate` has a `BLOCKED_EXTENSIONS` check (blocks
  .exe/.sh/.zip/.mp4/…) that exists BECAUSE the browser-supplied MIME is spoofable ("Audit F2")
  — and it's unit-tested. But it only fires `if (args.filename)`, and NEITHER care upload route
  passed `filename` — so on the PUBLIC customer widget route a visitor could upload `evil.exe`
  with `Content-Type: image/png`, satisfy the `image/` allow list, and slip the type gate (the
  extension guard never ran). §A26 class: the agent care-upload route had the identical omission.
  Not RCE (served as the claimed type), but it defeats the intended defense-in-depth and lets
  dangerous content into tenant storage on a public path. FIX: pass `filename: file.name` on both
  routes (trivial, safe — legit image/pdf extensions aren't in the block-list, so no false
  positives). Added a customer-path regression case pinning `invoice.exe`+`image/png` → blocked,
  `screenshot.png` → allowed. Gate green (512 tests). *Coverage honesty:* the underlying block is
  unit-tested and the routes now pass filename, but "the route passes filename" isn't itself
  route-tested (no route harness) — verified by reading + tsc.
  DEFINITIVE BOUNDARY (all 4 `validateUploadCandidate` callers, verified 2026-07-09): care/upload
  ✗→fixed, care/agent-upload ✗→fixed, files/route.ts ✓ (always passed filename, L241),
  files/upload-url ✓ (always, L54). So the bug was EXACTLY the 2 sibling care routes; the two
  files/* routes always followed the pattern. (Mid-sweep I misread a truncated grep as a 3rd
  instance in files/route.ts — the definitive grep corrected it BEFORE any edit to a correct file;
  §0/§5.) Two adjacent upload paths use custom (non-`validateUploadCandidate`) validation — BOTH
  verified CORRECT for their context, not gaps: (1) `coach/.../upload-recording` allows audio/video
  by design and therefore CANNOT use the shared `BLOCKED_EXTENSIONS` block-list (which forbids
  `.mp4`/`.webm`/`.mov` — the exact recording formats); its size + audio/video-mime-prefix check is
  right, and path traversal is already prevented by `buildStoragePath` (server path =
  `companyId/randomUUID.sanitizedExt`, never the raw filename); agent-only, and a spoofed non-audio
  file merely fails transcription. (2) `care/agent/tenant/logo` is sound (image-mime allowlist +
  server-DERIVED extension from the mime, never the user filename; SVG served via `<img src>` which
  sandboxes script → no XSS). Reaching "not a gap" on (1) required THINKING it through (§1.5.2/§0):
  the naive "add the block-list" fix would have BROKEN legitimate video recordings.
- **Voice endpoints (STT/TTS, public, cost-abuse-sensitive) verified sound — completes the
  public-surface sweep (2026-07-09).** Both token-gated (x-care-session → conversation), rate-
  limited, and input-bounded: TTS text ≤2000 chars @ 30/min; STT audio ≤2MB @ 8/min. STT was
  ALREADY hardened against the vendor-cost-abuse vector by a prior A21 audit (10MB→2MB, 30→8/min,
  documented in-route: "Scribe bills per minute; a single request could cost real money"). The
  per-instance rate-limit weakness is the already-flagged item 7. **Public attack surface now
  swept end-to-end:** widget messages IDOR ✓, file access IDOR+access_role ✓, upload mime-spoof
  ⇒ FIXED, inbound email spoofing ✓, TTS ✓, STT ✓. One real defect (upload) found + fixed; the
  rest sound with defense-in-depth.

- **§7 amendment / governance integrity verified sound (2026-07-09).** Cross-checked every
  amendment reference against the files: all 6 (AMD-001–006) exist and are ratified; CLAUDE.md
  inline-cites 001/004/005/006 (the section-ADDERS, each with a "> Added by" marker). AMD-002
  (gate numeric defaults) is ratified and correctly lives in migration 0002's `problem_thresholds`
  row (schema, not prose — §3.2 already described the gate); AMD-003 (per-company brain as the
  §3.4 IMPLEMENTATION) is ratified and reflected in CLAUDE.md §3.4 (month-1 control / no-fixed-
  day-one behavior) — it implements an existing principle, so no new-section marker was due. So
  002/003 lacking inline cites is CONSISTENT, not a §7.4 violation. CAT-001 cited (→ triggered
  AMD-005 §0.1); CAT-002 (chat-RLS recursion, the 2026-07-03 outage) recorded but correctly
  uncited — a technical incident fixed operationally, not one that amended the constitution. No
  dangling references either direction; the governance meta-process is internally consistent.

- **§3.5 durability loop (THE constitutional measurement moat) verified COMPLETE + correct
  end-to-end (2026-07-09).** All four links sound: (1) SCHEDULE — `schedule_support_durability_check`
  (0039:151) fires ONLY on the transition to resolved (`new.status='resolved' AND old IS DISTINCT
  FROM 'resolved'`), inserting one check at `now()+7d` (no spurious dupes on unrelated updates; a
  re-resolution legitimately earns its own window); security-definer + search_path pinned. (2) SWEEP
  — `sweepDurabilityChecks`, hardened this session (FIFO oldest-first + `bounded` honest-cap, tested).
  (3) RECORD — `recordDurabilityOutcome` write-once (tested, 4 branches). (4) READOUT — the §3.5
  durability readouts consume outcomes with honest-error states (fixed this session). So the moat
  measurement works start→finish; no dead link (unlike `task_slipped`, which IS dead — item 9).

- **§3.4 false-ok WRITE class swept across the data layer (§A26 boundary, 2026-07-09).** "Report
  success on a failed write" — the class behind the readout, write-once, and now bulk +
  captureResolution fixes. Swept `care.ts` / `chats.ts` / `salesCoach.ts` / `problems.ts` write
  functions: **only care.ts had genuine instances** — `bulkSet/AssignConversations` (returned 0 →
  route `ok:true`) and `captureResolution` (returned null → route HTTP 200, silently skipping the
  §3.5 durability schedule). Both FIXED + tested. All others are honest: `closeTopic` / `postMessage`
  (primary) / `toggleCoach` THROW; `setSessionStatus` / `setSessionOutcome` return null AND their
  routes return 500 on null (the check `captureResolution`'s route was missing); `appendSalesCorpusVersion`
  returns `!error`. The append-only §3.1 EVENT inserts that swallow are INTENTIONAL best-effort
  (documented — the column write is the visible result, a failed bonus-event mustn't undo it). So
  the false-ok write class is comprehensively addressed, not just the 2 ad-hoc fixes.
  **+ team route (2026-07-09):** swept the team DELETE handler after the 2026-07-07 member-removal
  false-ok fix and found its SIBLING unfixed — invitation-REVOKE checked `error` only, not rowcount,
  so revoking a nonexistent / already-accepted / RLS-blocked invite returned ok:true while the
  invitation stayed LIVE (admin thinks it's dead; invitee can still accept). FIXED by mirroring the
  member-removal strictUpdate (`.select` + 0-row → 404). Lesson: the member-removal fix should have
  swept its own sibling — a class fix must check the whole handler, not just the reported branch.
  **RLS-blocked-false-ok class swept codebase-wide (2026-07-09):** grepped every route doing
  `const { error } = await …update/delete` with no rowcount check (8 sites). Triaged by OUTCOME:
  the two with a HARMFUL outcome (member-removal, invitation-revoke — the desired change silently
  didn't happen) are FIXED. The rest are benign — `chat/topics/lock` verifies `created_by` before
  the update (sound, not a gap); `files/[id]/access` revoke, `tasks` update/delete, and the
  agent-toggle all end in the intended/benign state on a 0-row write (revoke-of-absent = already
  revoked; wrong-id = no-op) and RLS protects the data. So no HARMFUL false-ok remains; the class
  is bounded. (Low-value tail: those benign sites could still add a rowcount check for a crisper
  404 — not built, no data/outcome risk.)
- **`.maybeSingle`-on-2+-rows class (ae7eddf sibling sweep) — CLEAN codebase-wide (2026-07-09).**
  ae7eddf fixed a `.maybeSingle()` duplicate-guard that ERRORED on 2+ rows (pending invites had no
  DB uniqueness) → guard silently skipped → more dupes. Swept all 132 `.maybeSingle()` calls;
  triaged the ~22 on non-`id` filters. EVERY one is protected: `chat_participants` PK `(topic_id,
  user_id)`; `chat_topic_decisions` partial-unique open-dialogue index (route:118 / topicDecisions:108
  / the §3.3 participant checks); `smoke_test` one-active-per-company unique index; `support_customers`
  unique `(company_id, email)`; the rest are unique tokens or one-row-per-company tables. So the
  pending-invite instance was the SOLE one (fixed via 0098 + `.limit(1)`); no sibling remains.

- **§1.5.1 workflow-continuity check — resolution-capture flow PASSES + the false-ok fix also
  closed a continuity break (2026-07-09).** Traced the care resolution-capture workflow (AMD-006
  layer 3, the Close-without-auto-advance discipline): on capture, `onCaptured` (ConversationsApp:1770)
  AUTO-ADVANCES to the next conversation "without an empty-state interrupt" + fires the §3.6 debrief
  overlay alongside — sound continuity, no dead-end. **Bonus insight:** the ResolutionCaptureModal
  returns early on `!res.ok` BEFORE onCaptured, so with the captureResolution false-ok fix a FAILED
  capture now shows "Couldn't capture" and keeps the agent put. BEFORE the fix (route 200 + null on
  failure), the modal read success → auto-advanced the agent AWAY from a conversation whose
  resolution silently failed. So that §3.4 fix also fixed a §1.5.1 break (advancing past a lost
  capture) — the layers compound. Also: production build re-confirmed after the recent route changes.

- **RLS infinite-recursion class (CAT-002 anchor) verified BOUNDED — no latent outage (A29 sweep,
  2026-07-09).** RLS recursion (42P17) is outage-grade — a policy on A that queries B whose policy
  queries A → Postgres refuses to evaluate → the table is unreadable. Swept for cross-table policy
  cycles. Both cycles that EVER existed are fixed: chat_topics↔chat_participants (`0081`, the CAT-002
  outage — `security definer` helper `is_topic_participant()` breaks the loop) and files↔file_access_grants
  (`0063`/`0065` — `file_access_grants_select` tightened to grantee-only `profile_id = auth.uid()`, so
  it stops referencing files; the uploader-sees-grants capability moved to a stronger route auth
  check). All OTHER cross-table policy refs are ONE-directional (file_departments/tasks/tags/suggestions
  → files, crm children → crm_accounts — the parent never references the children back), so no cycle.
  Clean negative on a catastrophe anchor: no third recursion cycle exists to become the next outage.
- **RLS UPDATE tenant-key-push-out class (0095 anchor) — 2 gaps the audit MISSED, FIXED (A29 sweep,
  2026-07-09).** An UPDATE policy with `USING` but no `WITH CHECK` lets a member push a row's tenant
  key to a foreign value. The 2026-07-07 audit's 0095 covered the MED tier; sweeping the full class
  (all ~20 UPDATE-no-WITH-CHECK tables) found the audit relied on freeze triggers for 5 tables
  (files/team_invitations/chat_topics/chat_topic_decisions/departments freeze company_id) — and left
  TWO with neither WITH CHECK nor a freeze: **`task_steps` (`0101`)** and **`coaching_sessions`
  (`0102`)**. coaching_sessions is the sharp one: its owner-or-admin UPDATE let the OWNER change
  `agent_id` to a peer — reassigning their session into that peer's ELO computation, skewing the
  peer's rating (§3.5 integrity, no manager access needed) — or `company_id` cross-tenant. Both fixed
  by WITH CHECK mirroring USING (admin reassignment preserved). Class now genuinely complete (every
  table accounted for; 0101's "sole sibling" claim was premature — corrected in 0102). **Note the
  §3.5 through-line:** coaching_sessions/agent_id (here) + `outcome` (item 3) are BOTH ELO-integrity
  gaps — if you care about rating integrity, apply 0102 and gate `outcome` (item 3) together.
- **§3.5 ELO-integrity class swept to its THREE inputs (A29, 2026-07-09).** The ELO
  (`getAgentEloGames`) reads three things attributed to an agent — I swept all three: (1)
  `coaching_sessions` (agent_id + outcome) → 0102 + item 3; (2) `after_pitch_summaries` (graded
  scores) → already SAFE (INSERT is owner-scoped `agent_id = auth.uid()`, 0080); (3) `events`
  (`coach.dissect_generated` by actor) → **0103** — the events INSERT policy had no actor
  constraint, so a member could attribute a FABRICATED dissect to a victim and skew their rating
  (and, more broadly, inject actor-spoofed §3.1/brain events). So rating integrity is now closed at
  every input: apply **0102 + 0103** and gate **`outcome`** (item 3), and no member can move
  another rep's ELO.
- **Author-spoof class extended to the message tables (A29, 2026-07-09) → 0104.** 0103's
  fix (constrain the authorship column WHERE it's written) is a class, not a one-off. Sweeping
  it found the same shape at `chat_messages` and `support_messages`: the INSERT check gated the
  *caller* (participant / agent) but not that `author_id` is the caller, so a topic participant
  could post a message under a **co-worker's name** (impersonation, and chat feeds §3.1 + the
  brain), and an agent could post as a peer. Subtlety worth noting: 0103 *transitively* blocks
  the chat spoof for event-emitting kinds (the emit trigger is INVOKER and stamps the event
  actor from author_id, so it rolls back) — but `kind='system'` returns before emit and slips
  past, and the transitive cover evaporates if 0103 is unapplied or the trigger is switched to
  DEFINER. 0104 validates author_id at the row's own table (§1.5 defense-in-depth). **Apply 0103
  then 0104.**
- **Author-spoof class swept to its boundary (A29, 2026-07-09) → 0103–0106.** "Constrain the
  authorship column WHERE it's written" is a class. I enumerated every authorship column
  schema-wide (→ auth.users / profiles) and closed the consequential surfaces — those feeding
  ELO, the §3.1 chain, the brains, or communication-surface impersonation: `events.actor` (0103),
  `chat_messages`/`support_messages.author_id` (0104), `resolutions.decided_by`/`reviewer` (0105),
  `support_resolutions.captured_by` (0106). Two class-completeness catches worth noting: (a)
  resolutions was ALSO in the tenant-key push-out class (`company_id`/`problem_id` were mutable —
  the immutability trigger froze only action/reasoning/decided_at), fixed in the same 0105; (b)
  `problems`/`signals` are derivation-engine tables with no member INSERT path, so their
  `created_by` isn't member-spoofable. **Bounded residual (honest, not ignored):** the remaining
  authorship columns — entity `created_by`/`opened_by`/`closed_by`/`invited_by`/`added_by`/
  `assigned_by` on chat_topics, departments, tasks, team_invitations, etc. — are audit/display
  attribution (they don't feed ELO/decisions/impersonation), and several are freeze-protected by
  0096. I judged these LOW-consequence and did not migrate them; if you want belt-and-suspenders
  attribution integrity on those too, it's a mechanical follow-up (same one-line `= auth.uid() or
  null` pattern), not an urgent gap.
- **Tenant-key push-out class re-swept to boundary (A26 refinement, 2026-07-09) → 0107.** 0105
  revealing resolutions had been missed by this class (0095/0101/0102) was the tell that the class
  was *believed* complete but never exhaustively verified — so I re-swept every `company_id` table's
  member-reachable UPDATE path. Result: 38 tables verified SAFE (no member UPDATE / company_id
  pinned in with-check / company_id freeze trigger) and 2 net residuals, both fixed in 0107:
  `notification_subscriptions` (owner-update pinned only user_id) and `care_agent_state` (0095's
  guard froze max_concurrent/channels but not company_id — an agent could push their routing-state
  row cross-tenant). The class boundary is now recorded and auditable; a future §1.7 audit can diff
  against it. This is the concrete payoff of the A26 addendum's refinement #1 (check every
  candidate against ALL open classes): sweeping author-spoof surfaced a tenant-key gap, which
  surfaced a whole under-verified class boundary.
- **DELETE-side authz class swept to boundary (2026-07-09) → 0108 + 2 founder flags.** The two
  UPDATE-side misses (0105/0107) made the 2026-07-07 audit's DELETE-side completeness suspect, so
  I swept every `for delete` / `for all` policy (for-all grants delete too). Boundary: most tables
  are safe via a `do instead nothing` rule, no delete policy (default-deny), or correct company/
  owner scoping. **One HIGH breach fixed (0108):** `problems` — the §3.1 chain's centre — was the
  only chain link without a no-delete rule, and its ON DELETE CASCADE children (resolutions,
  problem_signals) meant a member deleting a problem wiped its resolutions THROUGH the cascade,
  defeating resolutions_no_delete (0094). Plus `company_brain` (member-deletable learned-model
  singleton). Two suspects were correctly EXCLUDED from the fix by intent, not pattern: `decisions`
  has a real delete path (mutable entity, not append-only) and `team_members` delete is a
  permission choice — both surfaced as founder decisions below rather than unilaterally changed.
- **SELECT (cross-tenant READ) swept — 0 suspects, the highest-stakes vector BOUNDED (2026-07-09).**
  With INSERT/UPDATE/DELETE swept, I closed the loop on the one remaining DML verb — and the most
  consequential, since a read leak beats any write bug. Every `for select`/`for all` policy on a
  tenant table pins visible rows to the caller's company (69 `p.id = auth.uid()` occurrences ALL
  carry the `and p.company_id = <table>.company_id` pin — the subtle authenticate-but-don't-scope
  leak occurs NOWHERE; no `using(true)`). The only two role-only SELECTs (`problem_thresholds`,
  `signal_sources`) are verified non-tenant global catalogs (no company_id column). So the read
  side was already solid — my write/delete finds were the real gaps, and the 2026-07-07 audit's
  SELECT work held up even though its write-side had holes.
- **⇒ Four-verb authz boundary COMPLETE (a §1.7 audit result — answers checklist #9).** INSERT
  (author-spoof, 0103-0106), UPDATE (tenant-key push-out, 38 tables + 0107), DELETE (immutability,
  0108 + 2 flags), SELECT (0 suspects) are each swept to a recorded, auditable boundary. This is a
  full ground-up authz audit; a future §1.7 pass can diff against it. The lesson worth keeping: the
  2026-07-07 audit *claimed* completeness but missed six write/delete gaps a verb-by-verb
  exhaustive re-sweep found — "audited" is not "exhaustively bounded" unless the boundary is
  enumerated and recorded (captured as the A26 addendum in the reasoning store).
- **A25 identity-resolution / cardinality class BOUNDED clean (2026-07-09).** Anchored on the
  three invite-cluster fixes (ae7eddf `.maybeSingle`-on-2+-rows, 46f1bf5 email-not-matched,
  feedback_admin_users_email_filter `?email=`-returns-a-list). Verified every choke point to
  ground: (1) admin email resolution goes through ONE helper, `findAuthUserByEmail` — it pages all
  users and matches the `email` field EXACTLY (never trusts the unreliable `?email=` param or
  `users[0]`), returns null on a miss, has a regression test, and NOTHING bypasses it; (2) the
  invite route matches the resolved user's id + company (`.eq("id", authUser.id).eq("company_id"…)`
  — the specific person, not "whoever sorts first") and guards `.maybeSingle` with `.limit(1)` /
  unique keys; (3) write cardinality is defended by reusable primitives — `strictMutate` (asserts
  the write landed) and `strictMutateOne` (throws if >1 row). The high-consequence facet (silent
  false-MATCH) is fixed + choke-pointed; the `.single()` facet fails LOUD (throws on ≠1), the safe
  failure mode. **One honest scale note (fails safe, not a bug):** `findAuthUserByEmail` pages up to
  50×200 = 10,000 users then returns null — on an instance with >10k auth users a lookup could
  false-negative MISS an existing user (a miss, never a false match, per the lesson). Fine at
  current scale; if the tenant base crosses ~10k users, switch to a server-side exact-email query.

- **AMD-006 four-layer audit of the team-management surface (2026-07-09) → 2 fixes + a class
  bound.** After verifying the team surface's BACKEND (the A25 class), I ran the §1.5.1 layer-2
  (effectivity) lens on the surface itself — evidence-picked because it had 3 recent bugs. Found
  two silent failures the backend fixes didn't cover: (1) `InviteRow.revoke` swallowed failure (no
  else on `if (res.ok)`) — the exact 558ce56 false-ok-in-the-UI class, fixed for MemberRow but not
  its sibling; now toasts the route's honest error. (2) `fetchTeam` conflated live-error with
  live-empty (§3.4/A14 — no `live-error` mode, `data ?? []`), so a DB/RLS rejection rendered as
  "No active members — onboarding hasn't completed"; added the mode + honest error UI + a 4-case
  test (mirrors the fetchTopics outage guard). Then swept the live-error-vs-empty class across the
  surface-fetchers: `fetchTopics` (chats) and `fetchProblems` already handle it correctly — so the
  class (data-fetchers that render a *distinct, blame-implying* empty state) is bounded clean.
  Shipped (e8f751d); 533 tests green.
- **Silent-mutation-failure UI class swept to boundary (A29, 2026-07-09) → 7 fixes (bda22b0).**
  The InviteRow fix was one instance of a class: a user-triggered mutation whose FAILURE path
  shows nothing, so the user believes it worked. Swept every client mutation handler (30 dashboard
  + 23 component files): the SAFE majority already toast/setError; 7 siblings matched the exact
  `if(res.ok){…}`-no-else / bare-unchecked-`await` shape. HIGH: `operations.deleteTask` (task
  stayed on screen), `files ClassificationModal.toggleGrant` (optimistic access-control flip that
  LIED on failure — now reverts). MED: `sales-coach.endSession`, `care CareShell` presence
  `setStatus` (governs routing), `care ReadPhasePanel.markComplete` (a workflow gate), `settings
  departments archive/unarchive`. All mirror existing in-file patterns; the 3 documented
  fire-and-forgets (debrief, learning-mode toggle, push fan-out) were correctly excluded. This is
  the UX-layer twin of the backend false-ok class (558ce56) — the same "a failed write must be
  VISIBLE" §3.4 principle, applied above the API line.

## Decisions waiting on you (each answerable in a sentence; fixes pre-written)
1. **talk-ratio / question-rate score** is raw magnitude, not quality (an over-talker
   shows 8/10). **Verified 2026-07-09 — GOOD NEWS, NO ELO re-baseline needed (I was wrong that
   "it feeds the rating"):** both are `computed: true` categories (`salesScore.ts:93,125`), and the
   ELO's quality mean EXCLUDES computed categories (`salesElo.meanScore01` filters `!c.computed` —
   code comment: "averaging them would distort performance downward"). So they do NOT feed the
   rating; the ELO already ignores them. The fix is therefore DISPLAY-ONLY: a raw share shown as
   "8/10" reads as a quality VERDICT it isn't (§A11 — a proxy dressed as a score). Reframe the
   strip — either invert magnitude→quality, or render it as a neutral share bar, not a /10. No
   rating recompute, no migration, no rep-facing rating change. Small + safe; one word and I apply it.
2. **Company settings** are editable by any member (RLS-allowed; sensitive columns
   frozen). Gate to admin-only, or keep member-editable? **Verified 2026-07-09:** both the
   RLS `company - update` policy (`0001:118` — `using (id = auth_company_id())`) AND the
   `PATCH /api/settings` route have NO role check, so any member can edit. **Fix pre-written
   (if you choose admin-only):** in `PATCH /api/settings` after `companyId` resolves, read the
   caller's `profiles.role` and return 403 unless it's leadership (CEO/COO — the exact `isAdmin`
   set from `careAgentAuth.ts:66`); optionally a one-line migration tightening the `company -
   update` RLS policy to the same predicate for DB-layer defense-in-depth. One word and I apply it.
3. **Session-detail control gating** (the narrowed A2 §A18 question): `upload-recording`
   / `label-transcript` are reachable by a manager viewing a rep's session because
   `SessionRecordingUpload` is rendered ungated (`[id]/page.tsx:822`); and
   `LiveCoachingPanel` shows a "Start live coaching" control even on ended sessions.
   Should the live-coaching + upload controls be OWNER-only and (for the live panel)
   ACTIVE-session-only, leaving managers/ended-sessions the review tools? Fix ready
   (isOwner UI wrap + `agentId → 403` on the 2 routes + status-gate the live panel).
   **Verified 2026-07-09 — premise + fix confirmed, and SEVERITY calibrated for you:** the
   upload-recording route authenticates + company-scopes but has NO owner check — `getSession(id)`
   succeeds for any same-company reader (RLS is company-scoped), so a manager CAN upload to a rep's
   session. This is a same-company manager WRITE (they already have READ access), so it's a
   data-integrity/gating question — a non-owner write pollutes the rep's session and thus their ELO
   — NOT a cross-tenant leak. Legitimate to decide, not urgent. The `agentId → 403` fix is exact
   (`session.agentId !== auth.user.id`); one word and I apply it.
   **CLASS EXPANDED (A29 sweep, 2026-07-09 — item 3 named too few routes):** the owner-only precedent
   is `finalize` + `transcript-append` (both explicitly gate `session.agentId !== auth.user.id → 403`,
   NOT trusting the RLS read). The SELECT RLS is owner+admin+**manager** (0084), so EVERY session-write
   route that relies on "RLS read = access check" lets a manager/admin write to a rep's session. The
   full class (not just upload-recording/label-transcript): **`outcome` is the HIGH-consequence sibling
   item 3 MISSED — a manager/admin can SET another rep's call outcome (sold/no_sale), which is HALF the
   ELO game score → directly skews that rep's rating (§3.5 integrity).** `decision` is lower (it inserts
   an event attributed to the actor's own id). So decide the class ONCE: should session writes be
   owner-only (matching finalize/transcript-append) or manager-allowed? If owner-only, I gate all four
   (`outcome`, `decision`, `upload-recording`, `label-transcript`) with the same `agentId → 403`. My
   rec: at minimum gate `outcome` owner-only regardless (ELO integrity shouldn't be manager-writable
   without an explicit "manager correction" flow); the rest are your call.
   **Severity re-calibrated (verified 2026-07-09):** NOT a silent hole — `setSessionOutcome` emits
   `coach.session_outcome_recorded` with `actor: <setter>`, so a manager setting an outcome is AUDITED
   (the event names who did it). And the UI already shows the control to viewing managers (item 3's
   premise), so this is an EXISTING capability, not a new exposure. That reframes it: the decision is
   permission-model ("should managers be able to set/correct a rep's outcome?"), not close-a-breach.
   So it's genuinely your call, not urgent — but if the answer is "no," `outcome` is the one to gate
   first (it moves the ELO). My build stays flagged, not applied, because gating REMOVES a current
   manager capability.
4. **Resolution review — write-once column vs appended event** (§3.1 architecture).
   FIXED the immediate defect this session (a68ce70): the review UI promised "you don't
   edit prior reviews" but the API had no write-once guard and did an in-place UPDATE —
   any same-company caller could silently overwrite `durability` (the §3.5 metric). Now
   enforced write-once (409 on re-review) + label corrected + a conscious durability
   choice required (was defaulting to "unknown", a hasty-Save footgun under write-once).
   **RESOLVED — built as `0100` (was flagged as your decision; on re-examination it wasn't
   one).** I originally deferred this as a product choice: event vs mutable-once column. That
   framing was wrong, and catching it is the §0/§5 discipline working. A genuine §3.1 reading
   doesn't leave it open — the measured consequence MUST be an **event** in the immutable chain
   so durability-over-time is replayable and the review joins `events → signals → problems →
   resolutions → events`. The precedent in your own codebase settles it: migration `0015`'s
   `chat_topics_durability_review_trigger` fires `chat.topic_durability_reviewed` (new +
   previous value) on every `close_durability` change. Resolutions was the ONLY one of the three
   §3.5-durability surfaces that didn't close its loop. So this was a constitutional gap, not a
   preference — I built `0100_resolution_durability_review_emission.sql`, mirroring 0015 exactly:
   an AFTER-UPDATE-OF-durability trigger emits `resolution.durability_reviewed` and derives a
   `resolution_held` / `problem_recurrence` / `partial_resolution` signal (sourced at the
   PROBLEM, so §1.2 retrospective analysis sees the recurrence). `unknown` earns no signal; no
   backfill (append-only honesty); idempotent; no double-count with 0015 (chat closes never
   insert into `resolutions`). **UNAPPLIED — apply it in each env.**
   **What genuinely remains your call (optional hardening):** the `check_resolution_immutability`
   trigger (0005:50-68) still permits `durability` to change at the DB layer, so the app-level
   write-once guard (a68ce70) is the only *freeze*. `0100` makes that safe-by-honesty — every
   change now emits an event and is preserved in history rather than lost (exactly 0015's
   posture: re-review is allowed and re-emits). If you'd rather also FORBID re-review below the
   app layer, say so and I'll add a once-only DB write-guard; otherwise 0100's record-every-change
   is the more §3.1-faithful choice and I'd leave it.

10. **`team_members` delete scope** (surfaced by the DELETE-side sweep). Any company MEMBER — not
   just an admin — can delete a `team_members` row (the `team_members - all` policy is
   company-scoped, not role-scoped). Its natural comparison, `profile_departments`, correctly gates
   delete to `role in ('CEO','COO','admin')`. Question: should removing a teammate be admin-only?
   If yes (my recommendation — it aligns with 558ce56's admin-mediated removal), I'll add a
   role-scoped delete policy in one migration. If member self-removal is intended, it stays. Not
   changed unilaterally — it's your permission model (§2/§3.3).

11. **`decisions` delete scope.** A decision outcome row is deletable by any company member (same
   company-scoped `for all`). Unlike the §3.1 chain tables, `decisions` is a mutable entity with a
   real delete path (`decisions/route.ts:103`), so it's correctly NOT append-only-frozen — but the
   delete is company-wide, not owner/admin-only. Question: should deleting a decision be restricted
   to its author or an admin? One-line policy change if yes; left as-is if collaborative delete is
   intended.

## ⚙ MIGRATION APPLY CHECKLIST (founder — I can't verify applied-state headless; CONFIRM each, apply if pending)
The COMPLETE documented-pending set, in order. Apply the whole set — a partial apply leaves the
corresponding protection/feature dormant. `npm run rls:audit` is green (all tables covered-or-documented);
these are the enforcement/feature migrations whose *applied-state* I can't see from here.

| # | What it does | Why it matters if skipped |
|---|---|---|
| `0085` | care_widget_load_events append-only (`do instead nothing`) | §3.1 immutability not live on that table |
| `0086` | crm_activity_events append-only | §3.1 immutability not live |
| `0087` | last_message_author_type col + trigger (inbox chime) | inbox-wide new-message chime stays inert |
| `0089` | vendor CRM authz (`is_vendor_super_admin`) — **was open to any customer admin (CRITICAL)** | cross-customer CRM exposure stays open; **confirm the vendor company id is yours** |
| `0095` | MED-tier UPDATE `WITH CHECK` (tenant-key push-out) | members can push tenant keys to foreign values |
| `0096` | definer `search_path` + guard triggers | search-path injection / column-freeze gaps |
| `0097` | (2026-07-07 authz queue tail — confirm) | — |
| `0098` | team_invitations partial-unique index (dedup) | duplicate pending invites possible |
| `0099` | coach v5 orphan-event §4-question doc | (documentation only — low urgency) |
| `0100` | resolution durability → event emission | **closes the resolutions half of the §3.1 loop** (missed deadlines/reopens don't signal) |
| `0101` | task_steps UPDATE `WITH CHECK` | task_step tenant-key push-out (MED) |
| `0102` | coaching_sessions UPDATE `WITH CHECK` | **ELO integrity — owner can reassign agent_id to skew a peer's rating** |
| `0103` | events INSERT actor guard (self-or-null) | **ELO + §3.1 + brain integrity — a member can attribute FABRICATED events to a victim (spoof a dissect → skew their ELO; inject false chain events)** |
| `0104` | chat_messages + support_messages INSERT `author_id` self-or-null (row-level twin of 0103) | **impersonation — any topic participant can post a message under a co-worker's name (feeds §3.1 + brain); an agent can post as a peer. 0103 only transitively blocks the event-emitting kinds; `kind='system'` slips past it — apply 0103 THEN 0104** |
| `0105` | resolutions: split for-all policy + INSERT `decided_by`/`reviewer` self-or-null + freeze decided_by/company_id/problem_id | **resolutions was exposed in BOTH swept classes at once — a member could fabricate/reattribute a resolution decision to a colleague (`decided_by` spoof → pollutes §3.1 + brain + §3.5 durability) AND relocate a resolution cross-tenant (`company_id` mutable). Immutability trigger froze only action/reasoning/decided_at** |
| `0106` | support_resolutions INSERT `captured_by` self-or-null | care-side sibling — an agent could capture a resolution attributed to a peer (skews the peer's captured-history/stats in the care brain). MED-LOW; completes the author-spoof class |
| `0107` | tenant-key push-out residuals: pin `notification_subscriptions.company_id` + freeze `care_agent_state.company_id` | re-sweep of the 0095/0101/0102 class found 2 tables still let a member relocate their own row cross-tenant (notification_subscriptions owner-update; care_agent_state self-update — 0095 froze the wrong columns). Completes the tenant-key push-out class boundary (38 tables verified safe) |
| `0108` | §3.1 immutability: no-delete rules on `problems` + `company_brain` | **HIGH — a member could `DELETE` a problem, and its ON DELETE CASCADE children (resolutions, problem_signals) get wiped, DEFEATING resolutions_no_delete (0094) via the cascade back door — the §3.1 chain's centre was the one link without a no-delete rule. company_brain (the learned-model singleton) was likewise member-deletable** |
| `0109` | `emit_task_overran_event` + `run_task_overrun_sweep` (the dead `task_slipped` emitter, item 9) | not a security fix — a CAPABILITY: the core product couldn't see missed deadlines. Safe to apply anytime; stays dormant until you wire the cron (feature, not enforcement) |

**Plus (env, not migrations):** `CRON_SECRET` (activates the §3.5 durability sweep — dormant without
it), VAPID×3 + REBUILD (push delivery), and the optional channels — see the ENV-VAR ACTIVATION MAP up top.
**Highest-leverage to apply first:** `0100` (§3.5 loop) + `0102` (ELO integrity) + set `CRON_SECRET`.

**After applying 0101–0108, VERIFY per-env** (verification discipline — rls-audit can't see a
live DB): run [`docs/closures/2026-07-09-authz-apply-verification.sql`](2026-07-09-authz-apply-verification.sql)
in each environment's Supabase SQL editor. It's read-only and prints one PASS/FAIL row per fix
(14 checks across the 8 migrations) — every row should read PASS; a FAIL names the migration that
didn't land. This is the "never assert a migration is applied without per-env verification" rule
made runnable.

## Retests I can't run headless
- The flags on your real sessions (see #1).
- A live call to confirm the 5 live-coaching cue fixes (stress speaker, empty-commit
  pace, triple-tap, sep-reset, stale-cue-after-restart) — logic + build verified, not
  runtime-verified.

Reply with a yes/no on any decision and I'll apply the pre-written fix immediately.
