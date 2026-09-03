# Gamification — Phase 0 Findings

Inspection of the TeamPilot codebase for the sales-gamification build (docs/sales-gamification/). Every answer
cites a real path or states "not present". Evidence marked ✔live was verified against the production database
(read-only, via .env.local service role) during this inspection. Confidence noted where not high.

> **Headline (read this first):** This repo is the **Sales Coach** — it **already transcribes and LLM-scores every
> session on dimensions with verbatim citations**. The gamification plan assumed no existing scoring; that
> assumption is false, and it reshapes the build (see 16 + I). The genuinely-new work is the **points ledger,
> scoreboard, and manager notifications** — not a second scoring engine.

---

## A. Stack & conventions

### 1. Framework / language / package manager / deploy
**Answer:** Next.js 16.2.6 (App Router) + React 19 + TypeScript. Package manager npm. Deployed on Vercel.
**Evidence:** `package.json`, `next.config.*`, `/api/health` (build.commit); CLAUDE.md operating notes.
**Confidence:** high.

### 2. Database + migrations + exact command
**Answer:** Supabase (Postgres + Storage + Auth). Migrations are SQL files in `supabase/migrations/NNNN_*.sql`,
applied via **`npm run db:apply`** (`node scripts/db-apply.mjs --apply`), which runs the pending migrations then a
30-invariant `verify:live`. NEVER hand-apply. Latest applied this session: 0240, 0241.
**Evidence:** `package.json` scripts (`db:apply`, `db:dry`, `db:verify`), `scripts/db-apply.mjs`, `supabase/migrations/`.
**Confidence:** high (I applied 0240 + 0241 this session).

### 3. Server-side data access pattern
**Answer:** A **data layer** under `src/lib/data/` (e.g. `src/lib/data/salesCoach.ts` — `getSession`,
`listAgentSessions`, `appendTranscriptSegment`) plus **App-Router route handlers** under `src/app/api/**/route.ts`.
Domain/AI logic lives under `src/lib/coach/**`, `src/lib/care/**`, `src/lib/llm/**`, `src/lib/brain/**`.
**Evidence:** `src/lib/data/salesCoach.ts`, `src/app/api/coach/**/route.ts`.
**Confidence:** high.

### 4. Testing
**Answer:** Vitest. Tests colocated in `__tests__/` dirs next to source. Run via `npx vitest run <path>` /
`npm run test`. Full gate `npm run check` (typecheck + lint + theme:audit + rls:audit + invariant:audit + tbc + test).
**Evidence:** `package.json` scripts, many `src/**/__tests__/*.test.ts`.
**Confidence:** high.

### 5. TS strict / shared domain types
**Answer:** TS strict. Shared domain types in the data layer (`src/lib/data/salesCoach.ts`: `SalesSession`,
`TranscriptSegment`, `Cue`, `CueOutcome`) and per-feature (`src/lib/coach/kpi/compute.ts` `MetricResult`,
`src/lib/coach/strategy/meeting/parseMeetingDissect.ts`).
**Evidence:** `tsconfig.json` (strict), `src/lib/data/salesCoach.ts`.
**Confidence:** high.

---

## B. Identity & roles

### 6. User representation + auth session
**Answer:** Supabase Auth users; app profile in **`profiles`** (PK = user uuid = `auth.uid()`). Auth context resolved
server-side by `getCurrentAuthContext()` → `{ userId, companyId, role, isAdmin }`, and `getCurrentCompanyId()`.
**Evidence:** `src/lib/supabase/auth-helpers.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/admin.ts`.
**Confidence:** high.

### 7. Agent vs user
**Answer:** An "agent" (sales rep) is a `profiles` row with a non-null **`sales_coach_role`**; a session's owner is
`coaching_sessions.agent_id → profiles.id`. `sales_coach_role` is a per-product flag distinct from the org `role`.
**Evidence:** `coaching_sessions.agent_id` (migration 0070); `src/lib/coach/v5/skillAccess.ts` (`isSalesCoachManager`).
**Confidence:** high.

### 8. Manager / reporting relationship  ⚠ CONFIRM EXACT PATH WITH INSPECTION AGENT
**Answer (needs agent confirmation):** There is **no per-agent `manager_id`/`reports_to` FK**. "Manager" is
resolved by **company scope + role**: a company admin (org `role` ∈ CEO/COO/admin) OR `sales_coach_role = 'admin'`
can see the company's reps. So an agent's "manager(s)" = the admins/sales-coach-managers of the SAME `company_id`.
**Implication for Phase 4 notifications:** recipient resolution is company-admins-of-the-agent's-company, not a
single manager FK (RUBRIC-SPEC 8 "resolved from whatever structure Phase 0 finds"). An agent can have several.
**Evidence:** `coaching_sessions` SELECT RLS (migration 0084 — `p.role in ('CEO','COO','admin') or p.sales_coach_role='admin'`);
`src/lib/coach/v5/skillAccess.ts`; org hierarchy (memory: 6-tier `profiles.role`).
**Confidence:** medium — the company-scoped model is verified; confirming there's NO manager FK is the agent's job.

### 9. Team / org grouping
**Answer:** `companies` (tenant) + `profiles.company_id`. One company has many admins + many reps; a rep belongs to
ONE company. Multiple admins ⇒ an agent effectively has multiple "managers".
**Evidence:** `profiles.company_id`, `coaching_sessions.company_id` (0070).
**Confidence:** high.

### 10. Permission enforcement (concrete example)
**Answer:** **Both** Supabase RLS AND route-layer checks. Example RLS (coaching_sessions SELECT, 0084):
`using ( agent_id = auth.uid() OR exists(select 1 from profiles p where p.id=auth.uid() and p.company_id=coaching_sessions.company_id and (p.role in ('CEO','COO','admin') or p.sales_coach_role='admin')) )`.
Writes mostly go through service-role routes after an auth+ownership check.
**Evidence:** migration 0082 (insert owner-scope), 0084 (select owner-or-manager); `src/app/api/coach/sales-session/[id]/finalize/route.ts` (owner-only route check).
**Confidence:** high.

---

## C. Sessions (critical)

### 11. Session table + columns
**Answer:** **`coaching_sessions`**. Columns: `id, company_id, agent_id, context, client_label, status,
session_kind, audio_asset_url, audio_duration_seconds, territory, approach, offer, outcome, deal_value, started_at,
ended_at, created_at` (+ `recording_saved`). Owner = agent_id, tenant = company_id.
**Evidence:** migrations 0070 (foundation), 0077 (territory/approach/offer/outcome), 0205 (deal_value), 0210
(audio_duration_seconds), 0237 (session_kind).
**Confidence:** high.

### 12. Channels distinguishable  ⚠ ONLY TWO, NOT THREE
**Answer:** `coaching_sessions.context` ∈ **`in_person` | `video`** (0070 check). ✔live: 343 in_person / 12 video of
355 sales sessions. There is **no `voice_call`** channel today. door-knock "Macro Mode" is a separate door-log path.
The rubric's 3-channel model (door_to_door / voice_call / video_call) must map onto **in_person → door_to_door,
video → video_call**; voice_call is absent.
**Evidence:** migration 0070 (context check); ✔live `scripts/diag-gamification-distribution.mjs`.
**Confidence:** high.

### 13. Transcript stored?
**Answer:** Yes — **`coaching_transcript_segments`** (append-only): `speaker` (agent|customer|unknown), `text`,
`seq`, `source`, `spoken_at`. BUT ✔live only ~40% of sampled sessions have persisted segments — the rest keep the
durable **audio** and are re-transcribed on demand (diarized) by the after-pitch/dissect path.
**Evidence:** migration 0070 (segments), 0236 (source); ✔live distribution; `src/app/api/coach/meeting-session/[id]/dissect/route.ts` (on-demand re-transcription pattern).
**Confidence:** high.

### 14. Audio / transcription service
**Answer:** Private Supabase Storage bucket **`assets-v1`** (250 MB cap as of 0241). Transcription = **ElevenLabs
Scribe** (`scribe_v1`, diarized) via `src/lib/care/voice/elevenlabs.ts` (`transcribeWithDiarization`). Live audio
uses a Scribe realtime token. Durable audio is stitched from chunks (`src/lib/coach/v5/stitchSessionAudio.ts`).
**Evidence:** `src/lib/care/voice/elevenlabs.ts`, `src/lib/coach/v5/stitchSessionAudio.ts`, migration 0062/0241.
**Confidence:** high.

### 15. What marks a session finished
**Answer:** `status` transitions `active → ended → reviewed`; `ended_at` stamped by the 0070 active→ended trigger.
Client calls the server finalize on Stop; `auto-close-stale-cron` closes abandoned sessions. Meeting audio
self-heals/stitches on review.
**Evidence:** `src/app/api/coach/sales-session/[id]/finalize/route.ts`, `.../auto-close-stale-cron/route.ts`, 0070 trigger.
**Confidence:** high.

### 16. Existing scoring/QA on a session  ⭐ THE DECISIVE FINDING
**Answer:** **YES — extensive.** `after_pitch_summaries.payload.scores` already stores, per session, an array of
dimension scores each with `{ key, label, score (0–10), display, citation (verbatim quote), rationale (coaching
sentence, grounded in methodology e.g. Carnegie) }`. ✔live dimensions seen across 58/60 sampled: **talk_ratio,
question_rate** (computed) + **opener, objection, tone, close, next_step** (LLM-judged). 152
`coach.after_pitch_summary_generated` events exist. Additionally the **KPI layer** (`src/lib/coach/kpi/compute.ts`)
computes conversation-quality dimensions (discovery, rapport, objection handling, closing) with cited evidence, and
the artifact generator (`src/lib/coach/v5/generateSessionArtifacts.ts`) produces the dissect/summary/moments.
**Overlap vs RUBRIC-SPEC's 5:** Opening&Rapport≈opener+tone ✅; Objection Handling≈objection ✅; Advance&Close≈
close+next_step ✅; Discovery≈question_rate (computed, not judged) ⚠; **Value Framing = no existing equivalent ❌**.
Citations exist on ~48% of stored dimension-scores (the judged ones), NOT universally as the rubric requires.
**Evidence:** ✔live `scripts/diag-existing-scores.mjs`, `scripts/diag-score-dimensions.mjs`;
`src/lib/coach/v5/generateAndStoreAfterPitch.ts`, `src/lib/coach/v5/generateSessionArtifacts.ts`, `src/lib/coach/kpi/compute.ts`.
**Confidence:** high. **This is the finding that turns Phase 2 from "build a judge" into "reuse/extend the judge you have".**

**Full existing-scorer stack (agent-cited):** the rubric scorer `src/lib/coach/v5/salesScore.ts` (ScoreKey: opener,
objection, talk_ratio, question_rate, tone, close, next_step — the same dims seen live); six-skill /10 analytics
`src/lib/coach/v5/skillAnalytics.ts`; a **self-ELO** rating `src/lib/coach/v5/salesElo.ts` (per-session game vs 1500,
K=24, provisional <5 games); **letter grades** `src/lib/coach/v5/skillGrade.ts` + `salesEloGrade.ts` (badges in
`src/components/sales-coach/`); the **KPI layer** (migration 0205 `agent_baseline`/`kpi_snapshot`/`growth_record`,
`src/lib/coach/kpi/`). So a rank-adjacent system (ELO + grades + KPI) ALREADY EXISTS — gamification risks being a
**third** scoreboard. The Macro-mode door path has its OWN scorer too (`pitch_analyses.scores`, migration 0215).

---

## D. Deals

### 17. Where "deal closed" lives
**Answer:** On the session: **`coaching_sessions.outcome`** ∈ (sold, follow_up, no_sale, no_contact, undecided) +
**`deal_value`** numeric(14,2). No separate deals/opportunities table; no CRM. "Closed" = `outcome = 'sold'`.
**Evidence:** migration 0077 (outcome), 0205 (deal_value); the outcome-capture route `.../[id]/outcome/route.ts`.
**Confidence:** high.

### 18. Deal → session attribution
**Answer:** **Directly session-attributed** — outcome/deal_value are columns ON the session. So Phase-4 "deal_closed"
notifications CAN carry the specific session + its score (RUBRIC-SPEC 8 best case). No date-proximity guessing needed.
**Evidence:** as 17.
**Confidence:** high.

### 19. Deal reversal
**Answer:** `outcome` is a mutable column (set via the outcome route); it can be changed later. There is no explicit
"refunded/lost-after-close" state beyond re-setting outcome. ⚠ CONFIRM whether the outcome route allows post-hoc edits.
**Evidence:** `.../[id]/outcome/route.ts`.
**Confidence:** medium.

---

## E. Notifications  ⚠ CONFIRM WITH INSPECTION AGENT

### 20. Existing in-app notification mechanism
**Answer (needs agent confirmation):** No general per-user "notifications" table/bell is known to me from this
session. Manager-facing signals today are surfaced as **KPI exception flags** (a rep slipped ≥15% below baseline)
computed on read in the team KPI rollup, and the founder session-monitoring surfaces — not a stored notification
inbox. Phase 4 likely needs a NEW `manager_notifications` table (as the plan's Phase 1 4 anticipates).
**Evidence:** memory (founder session-monitoring; KPI team rollup); agent to confirm no existing notifications table.
**Confidence:** low — this is the biggest item to confirm before Phase 4.

### 21. Smallest addition
**Answer:** A `manager_notifications` table (recipient_id, agent_id, session_id, score_id, type, payload jsonb,
created_at, read_at) + an unread-count read + a list surface in the existing dashboard shell. Matches repo patterns
(a company-scoped table with RLS + a dashboard page). **Describe only — Phase 1/4 build it.**
**Confidence:** medium.

---

## F. Background work

### 22. Queue / cron / worker
**Answer:** **Vercel Cron** routes under `src/app/api/**/*-cron/route.ts` (e.g. auto-close-stale-cron,
backfill-dissects-cron, recording-purge-cron), gated by `CRON_SECRET`; declared in `vercel.json`. In-request
deferral uses **`after()` from `next/server`**. No dedicated queue service.
**Evidence:** `src/app/api/coach/sales-session/*-cron/route.ts`, `vercel.json`; memory (bare-void-write → after()).
**Confidence:** high.

### 23. Slow-work pattern
**Answer:** Either a cron sweep over rows in a `pending`-like state, or `after()` for fire-and-forget past the
response, or a long `maxDuration` route (up to 300s, used by finalize + dissect). The after-pitch generation runs
server-side under keepalive with per-engine timeouts.
**Evidence:** `.../finalize/route.ts` (maxDuration 300), meeting dissect route.
**Confidence:** high.

---

## G. LLM access

### 24. Existing LLM client to reuse
**Answer:** Yes. Provider cascade in `src/lib/llm/` (DeepSeek primary — `src/lib/llm/deepseek.ts`, endpoint
api.deepseek.com, models `deepseek-v4-flash` reasoning + `deepseek-chat` non-reasoning; Anthropic alternate).
Entry points in `src/lib/claude.ts` (e.g. `dissectCoachV5`) routed through `src/lib/brain/` (`runBrainCall` — the
per-company composer + 3.4 control gate). Reasoning-headroom + JSON-mode handled in the provider. Creds from
`DEEPSEEK_API_KEY` / `ELEVENLABS_API_KEY` env.
**Evidence:** `src/lib/llm/deepseek.ts`, `src/lib/llm/index.ts`, `src/lib/claude.ts`, `src/lib/brain/index.ts`.
**Confidence:** high (worked in this layer this session).

---

## H. Data reality (H25)

### 25. Session duration + transcript length distribution  ✔live
**Answer:** 355 sales sessions (session_kind sales/null). **Duration** (n=78 with real audio length): p10 17s, p25
51s, **p50 121s**, p75 227s, p90 344s; ~27% under 60s. **Transcript segments** (sampled 120; 47 have >0 persisted):
p75 7, p90 19, max 50; **agent turns** p75 5, p90 12. On the rubric's guessed "6 agent turns" gate, 77% of the
*sampled* sessions would be not_scoreable — **but that is misleading**: ~60% have 0 *persisted* segments because
their transcript is in the durable audio (re-transcribed on demand). Eligibility must run on the *re-transcribed*
turn count, not persisted segments. Recommend tuning the gate against a re-transcribed sample, and lowering the
60s→~30-45s floor given p25=51s.
**Evidence:** ✔live `scripts/diag-gamification-distribution.mjs`.
**Confidence:** high (the persisted-vs-audio caveat is the key nuance).

---

## I. Risks that make later phases harder (most valuable section)

1. **DUPLICATE-SCORING RISK (16) — the biggest one.** A second parallel rubric judge would re-transcribe +
   re-score sessions the after-pitch pipeline already scored (152 done), doubling ElevenLabs+LLM cost on the same
   audio and creating **two divergent "scores"** (2.2 single-source violation). The honest architecture is
   gamification (points ledger + scoreboard + notifications) layered on the EXISTING score, OR extending the
   existing scorer to also emit the rubric's clean 5 — not a standalone Phase-2 judge. **This is a founder decision.**
2. **Transcript is often not persisted as turns.** Scoring must re-transcribe from audio (like the dissect path),
   so the eligibility gate + "6 agent turns" logic can't read `coaching_transcript_segments` alone (13, 25).
3. **Only 2 channels, not 3** (12) — the rubric's voice_call anchors are unused; map in_person→door_to_door.
4. **No per-agent manager FK** (8) — notifications resolve to company-admins; "several managers" is the norm, not
   an edge case. RLS for scores must use the same company+role model as coaching_sessions (0084), not a manager FK.
5. **3.4 month-1 control gate** — the brain suppresses guidance for a company in its control month. The after-pitch
   scorer is `controlExempt`. A gamification scorer must decide its control-gate posture explicitly (likely exempt,
   since a rubric score is measurement not guidance) — get it wrong and scores silently vanish for control-month companies.
6. **Two KPI systems already** (door-Macro `doorlog.ts` vs session `compute.ts`) — do NOT add a third scoreboard
   that conflates them; the gamification scoreboard is session-based, keep it separate from the door-Macro KPIs.
7. **Append-only event + ledger patterns exist** — reuse them (the `events` chain, the append-only discipline) for
   the point ledger rather than inventing a new mechanism; a UPDATE/DELETE-blocking trigger is the established shape.
8. **Multi-tenant company scoping** — every new table needs `company_id` + RLS mirroring 0084, or it leaks across tenants.
9. **★★ PRIVACY INVERSION (agent-confirmed, high) — the deepest conflict.** After-pitch SCORES are DELIBERATELY
   **rep-private** (owner-only RLS, migration 0080) — a ratified A18 decision so a manager CANNOT build a
   "who-scored-low" surface. A gamification **leaderboard that ranks reps by score and shows it to managers/peers
   directly violates that ratified privacy model.** This is not a coding detail — it is a constitutional tension the
   founder must resolve BEFORE Phase 1 (it sets the RLS). Options: expose scores on a board (overturn A18),
   gamify within privacy (rank/points visible, per-session detail stays private), or opt-in. Ties directly to D12.
   **Evidence:** migration 0080 (owner-only after_pitch RLS); ThinkerThinker A18.
10. **★ OUTCOME-ENUM DATA BUG (agent-found, high) — latent.** Migration 0077 created
   `coaching_sessions.outcome CHECK in ('sold','follow_up','no_sale','no_contact','undecided')`; migration 0205 tried
   to `add column if not exists outcome CHECK in ('won','lost','no_decision')` — a **NO-OP** (column already existed),
   so the LIVE constraint is 0077's values. App writes/filters `outcome='sold'`, but 0205's KPI semantics assume
   'won'. **Any deal/quota gamification anchored on 'won' matches ZERO rows.** Resolve the outcome vocabulary before
   building deal/quota gamification on it. **Evidence:** migrations 0077 vs 0205; `src/lib/data/salesCoach.ts` (SALES_OUTCOMES).
11. **3.4 control-gate month-1 suppression** — LLM-graded scores are suppressed for a company's first month unless
   the call sets `controlExempt: true` (deterministic talk_ratio/question_rate survive; graded dims don't). A
   gamification scorer must set its control posture explicitly or scores silently vanish for control-month companies.
   **Evidence:** `src/lib/claude.ts` (controlExempt), `src/lib/brain/index.ts` (runBrainCall gate), `salesScore.ts` (suppressed→empty).
12. **The honesty/anti-verdict discipline** — every existing scorer is built on "mirror, not verdict; invite coaching,
   not penalty" (A11/A18), no-F-grade, null-not-0, caveat-not-verdict, all unit-pinned. Gamification framing
   (points, ranks, badges, "needs coaching" band) collides with this and will meet audit-gate + design-intent pushback.

---

## Decisions this surfaces (to put to the founder as pickers BEFORE Phase 1)

- **★ ARCHITECTURE (new, not in OPEN-DECISIONS):** reuse existing after-pitch scores as the point source /
  build a new parallel rubric judge / EXTEND the existing scorer to emit the rubric's 5 clean dimensions. (Grounded
  in 16 — the plan assumed no existing scoring.)
- **D1** score ceiling (existing scores are 0–10 per dimension over ~7 dims; the rubric proposes 5×10=50).
- **D4** scoreboard primary sort (points vs deals).
- **D12** agent-to-agent score visibility (sets Phase-1 RLS).
- **D15 / D13** agent-facing feedback view (the after-pitch review already IS an agent feedback view — overlap).

## Definition-of-done status
- `docs/gamification/FINDINGS.md` written (this file), all 26 items answered, most with live/path evidence.
- ⚠ Items 8, 19, 20 marked for inspection-agent confirmation (manager FK absence, outcome-edit, notifications table).
- No application code/schema/migration created in Phase 0 (only this doc + read-only diag scripts under `scripts/`).

## STOP (per Phase 0)
**Transcripts EXIST** (persisted segments + durable audio re-transcription) — Phase 1+ can proceed. The critical
divergence from the plan is 16: **scoring already exists**, so the architecture decision above must be answered
before Phase 1. Not starting Phase 1. Bringing the decisions to the founder next.
