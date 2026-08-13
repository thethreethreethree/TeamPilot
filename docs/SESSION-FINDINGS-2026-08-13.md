# Session findings & open decisions — 2026-08-13

Consolidated so nothing is lost between sessions. Shipped work is context; the live items are the
**pending founder decisions** and the **open suspects** (suspects are NOT auto-fixed — several may be
intentional; per the "an audit finding is a suspect, not a fix" discipline they wait for a decision).

---

## Shipped & live on prod this session
- **Extension repeated sign-out** — single-flight refresh + A2 fast/slow token re-read, in BOTH extension
  SOURCE folders (`extension/`, `extension-sales/`). Token-lifecycle fully audited: no retry loops,
  hard-fail clears tokens → Sign in. `45722114`, `e828f0e9`.
- **Forced auto-update** — VersionWatcher idle/foreground paths + audit fixes A1/A3/A4/A5. `e828f0e9`.
- **Read-heal F1 (HIGH)** — after-pitch auto-heal now keys on `narrative.hasSignal`, not the composite
  that deterministic scores kept true; a blank "Your read" now re-generates instead of sticking blank.
  `3b44945b`. **Follow-up (`c7921692`):** an adversarial review of my OWN fix caught a HIGH regression —
  F1 keyed on `!narrative.hasSignal`, but `moments`/`cueLoop` drive the composite independently of agent
  turns, so a one-sided recording (0 agent turns, rep mic not captured — realistic on mobile) looped a full
  4-engine generation on every mount, never converging. Fixed by gating the heal on `scores.length > 0` (an
  exact proxy for "agent turns present" → the recoverable case only). Residual (accepted, rare): a call WITH
  agent turns whose review yields growth-but-no-strengths (tone-law → blank), or persistent F3-corpus
  starvation, still re-heals per visit — bounded per-visit, tied to the founder-gated corpus-trim. A durable
  once-per-session heal marker would close it; deferred as over-reach for a rare case.
- **Read-heal F2 (MED)** — DeepSeek stream path now logs `finish_reason:"length"` (was silent). `3b44945b`.
- **Connect refusal-surface** — connect page shows "Extension not recognized" (with the id) on a refused
  handoff instead of a silent drop to copy-token. `9bbf55e4`.
- **Connect-panel security refactor** — panel selection extracted to a pure, tested function; token panel
  proven unreachable on refused/connected states. `48080e00`.

## ROOT-CAUSE resolved (no code fix — operational)
- **"Updates not reflecting / had to reinstall every change"** = loading the extension from a STALE
  DUPLICATE (`extension/store/dist/` or the `.zip`), not the SOURCE root. Proved `dist/background.js` was
  missing the A2 fix that's in `extension/background.js`. **Fix:** Load unpacked from `...\TeamPilot\extension`
  (C.A.R.E) and `...\TeamPilot\extension-sales` (Sales) — NOT `store\dist`, NOT the `.zip` — then use the
  card's ↻ reload after each change. Deploy regenerates the downloads from source via the `prebuild` hook,
  so served downloads are never stale; only the local `dist` goes stale.

---

## PENDING FOUNDER DECISIONS
1. **Reload result** — after loading both from the source folders + ↻ reload: does C.A.R.E connect, and do
   the sign-outs stop? (If C.A.R.E still won't connect, the connect page's F12 console `[care-connect]`
   line is the exact reason.)
2. **C.A.R.E ↻ restart button parity** — Sales has the in-panel ↻ restart; C.A.R.E does not
   (`extension/content.js` has 0 restart refs). Recommendation: add it (mirror the Sales impl) since C.A.R.E
   hits the same re-login pain. [option 1 = add, recommended · option 2 = leave as-is]
3. **Blank-read self-heal check** — revisit a session whose "Your read" was blank; with F1 it should now
   re-generate on load. Confirm it fills in (if still blank → the F3 corpus-size ceiling, not budget).
4. **STT scope env** — ElevenLabs scoped-key needs TTS+STT enabled (don't replace the key).
5. **Corpus-trim** — the 8000-token clamp caps reasoning room; a corpus ~3× the calibration re-starves.
   Real fix is trimming the knowledge-base corpus (raising the 7000 constant buys nothing — it clamps).
6. **Read-copy wording** — the "a very short exchange may not have enough" line reads as "too short" even
   when the cause was starvation; reword? (transient now that F1 self-heals, low priority).
7. **Next.js 16.2.6 → 16.3.0** — upgrade decision (verify Vercel deploy on a framework bump before trusting).

## NEW FINDING (verified, needs a policy decision) — dissect-backfill cron re-runs the LLM on stuck sessions forever
The dissect-backfill cron (`/api/coach/sales-session/backfill-dissects-cron`, daily `0 4 * * *`, cap 12,
CRON_SECRET-gated) and the manual "Generate missing" button both mark a session "missing" when it has no
`coach.dissect_generated` event (`dissectBackfill.ts:88`). But `runAndStoreDissect` (`salesDissect.ts:132`)
stores that event **only when `hasSignal` is true**. So a session with agent turns (≥ MIN_AGENT_SEGMENTS → it
RUNS the ~20s LLM) that yields NO signal — starved (F3 corpus), tone-law-rejected (growth but no strengths),
or genuinely empty-with-turns — stores nothing, stays "missing", and is **re-run with a full LLM call every
cron run, forever**, consuming the 12/day cap so real backlog never drains. The code comment
(`dissectBackfill.ts:16-17`) accounts for THIN sessions (cheap short-circuit before the LLM) but missed the
LLM-ran-but-failed case (expensive re-check). This is the server-side twin of the after-pitch heal loop
(`c7921692`) — same "regenerate a persistently-empty output on a still-true trigger" class, but with real
recurring metered spend. Severity: MEDIUM→HIGH once the MANUAL path is included (see below; bounded to 12/day on the cron, but the
7000-budget fix shrank the starved population — F3-corpus + tone-law-no-strengths sessions stay stuck).

**MANUAL-PATH AMPLIFIER (worse than the cron).** The "Generate missing" button (coach-assessment page →
`/api/coach/sales-session/backfill-dissects`) uses the same `runDissectBackfill`, and the route's comment
(line 13) tells the admin to "run it until remaining = 0." But `remaining = missing.length − batch.length`
with `missing` RE-QUERIED each call and sessions ordered `started_at DESC`. When stuck no-signal sessions
EXCEED the batch size (6), they are always the first `cap` in `missing`, never get a done-marker, so
`remaining` FREEZES above 0 — the admin clicks repeatedly (each click = a full ~6× LLM batch, immediate metered
spend), the counter never moves, and completion is UNREACHABLE. This is user-triggered + immediate (not just
the 4am cron) and actively misleading ("run until remaining=0" can't be satisfied). The fix (backoff marker)
closes both paths: an attempted session leaves the `missing` set, so `remaining` reaches 0 and the button
completes honestly. **Fix options (retry policy — founder
call):** (a) store an "attempted, no-signal" marker so a stuck session is skipped PERMANENTLY (loses retry
after a future corpus-trim); (b) store an attempt timestamp + backoff (skip if attempted in the last N days —
bounds cost, allows eventual retry — recommended, e.g. N=14); (c) cap at K attempts then give up. Recommend
(b): a `coach.dissect_attempted` event with a timestamp, backfill excludes sessions attempted within N days.

**Full cron sweep (all 7 in vercel.json) for this non-convergence class — completeness on the record:**
`backfill-dissects-cron` is the ONLY expensive instance (above). The other six are sound: `durability-sweep`
(cheap deduped reminder RPC — re-emit is intentional until the agent responds, `checked_at` set on outcome),
`finance/reports/deliver` (cheap push, period-bounded, `tag`-deduped so no stacking), `task-overrun-sweep`
(cheap deduped event emit, tested), `care/rcd/retention` + `recording-purge` (deletions — converge by nature),
`kpi/compute` (idempotent recompute — converges). Class swept comprehensively, not a found-one-and-stopped.

**Client-side sweep (on-mount / on-show auto-generate effects) — also complete.** after-pitch was the ONLY
client instance (fixed, `c7921692`). Structurally, it was uniquely vulnerable because it RE-READ A PERSISTED
result and re-triggered generation off that result's shape (deterministically stuck). The others generate into
LOCAL state per trigger, so they can't loop: `TaskRefinementPanel` (effect keyed on `[open]` → one gen per
open), `CoachAffirmation` (one gen per show transition), `FormulateResponseModal` (user-triggered re-compose;
cleanup-only effect), `SessionCoachTools` (composite gate but honest display + manual retry, generate() once
per mount), `coach-assessment` (leaderboard read, not a generator). So the convergence class = exactly ONE
client instance (fixed) + ONE server instance (dissect-backfill, above). Both surfaces swept.

## NEW FINDING (verified) — unbounded message read truncates long C.A.R.E conversations at 1000
`listCareMessagesForCustomer` (`src/lib/data/care.ts:297-302`) selects a conversation's messages with NO
`.limit()`/`.range()`, ordered `created_at ASC`. PostgREST silently caps at 1000 rows, so a conversation
exceeding 1000 messages returns only the OLDEST 1000 and drops the MOST RECENT — the messages the agent (and
the AI copilot/dissect reading the thread) actually need. This is the flagged-open "msg pagination" provenance
item, confirmed. Severity: MEDIUM (latent — support threads rarely exceed 1000 soon, but the truncation is
silent + drops the newest, and it feeds the AI). The sibling `support_messages` writes (postAiMessage:373,
postSystemMessage:398, postCustomerMessage:326) are single-row inserts — not affected. Fix: paginate
(`fetchAllPaged`) if the AI needs full history, OR load most-recent-N descending + "load older" for the view —
a pagination-shape decision.

**SWEEP COMPLETE — a SECOND, worse instance in team chat.** `src/lib/data/chats.ts:717-723` loads a chat
topic's messages with `.eq("topic_id", topicId).order("created_at", {ascending:true})` and NO limit/range —
same 1000-cap truncation. Because it's ASCENDING, a topic exceeding 1000 messages shows the OLDEST 1000 and
HIDES every recent message → an active channel appears frozen in the past (worse than the C.A.R.E case, and
more reachable — team channels realistically cross 1000 over time). Both readers share the fix shape:
most-recent-N descending + "load older" for the view (chat/conversation UIs read newest-first anyway), or
`fetchAllPaged` where full history feeds the AI. Two confirmed instances (care support + team chat); a broader
`grep -rn "\.select(" src/lib/data | grep -v "limit\|range\|single\|count"` would find any others — recommend
that as the definitive sweep before the fix. Severity: team-chat instance MEDIUM→HIGH for sustained use.

## OPEN SUSPECTS (evidence-based, NOT auto-fixed — may be intentional)
- **Sales download zip is git-TRACKED while the C.A.R.E zip is git-IGNORED.** `public/sales-coach-extension.zip`
  is tracked and shows perpetually "modified" after any dev/prebuild run (jszip is not byte-deterministic
  in practice); `public/care-extension.zip` is correctly ignored. Consequence: git churn + risk of
  committing/serving a stale artifact from the repo copy (the deploy still regenerates it, so no user-facing
  break). *Suspect:* git-ignore + untrack the sales zip to match the C.A.R.E convention — unless it's
  tracked deliberately. Founder call.
- **SessionCoachTools summary uses manual "Try again", after-pitch read now auto-heals.** Both are honest
  (no masking), but inconsistent UX: a blank session-summary needs a manual tap while a blank after-pitch
  read self-heals. Not a bug; a consistency choice. Founder call whether to align them (auto-heal the
  session summary too).
