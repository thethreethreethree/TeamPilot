# ELOSALES — Standard-mode Web Revision (governed build record)

> **Status: PLANNING — build HELD pending founder rulings on the OPEN conflicts (§4).**
> Source spec: `Elosales Web version (1).pdf` (founder-supplied 2026-07-16). Scope: **Standard mode of the web
> version ONLY. Expert mode must remain byte-for-byte unchanged.** The PDF is the specification and must be
> followed as written; where it leaves a choice, a recommendation is offered but the founder decides. Deviating
> from the spec OR the framework is a violation, not an improvement (founder directive, this session).

## 0. Precondition gate (§0.1 / A19) — satisfied

Read THIS session, from the working tree (not memory): `CLAUDE.md`, `docs/amendments/AMD-006-…md` (full),
`ThinkerThinker.md` assets **A8, A9, A10, A11, A18, A19**. A19's precedent (labels-cited-without-content) is why
the content — not the "§A18" labels in the current screens — is the authority here.

## 1. The spec, transcribed as written (do not paraphrase away)

**1. Sessions tab**
- a. Erase everything and have this section where all the team members are here and they have their own profile
  once the manager clicks on their name.
- b. Once clicked, the manager can see all their recordings the past 2 days. Then it deletes the recordings after
  2 days (unless saved by the manager or user).

**2. Analytics section**
- A. Take all of these out.
- B. Instead list out all the team members here, then once the manager clicks on their name, it opens up a profile
  page where the managers can see what the rep is struggling on, what he is doing well. And the scores A+, A, A-,
  etc for **Tone, Speed of Speech, talk/listen, questions, closing, objections**.
- C. This allows the manager to dissect their team members' analytics — transparency on who is doing well and who
  is struggling. The data allows them to teach their team members better.
- Goal (verbatim intent): transparency for managers. If a rep is struggling, the manager goes on his profile and
  has transparency on what the rep is saying and how to help through data. If a rep is doing well, the manager
  sees what he is saying and replicates it across the team → more sales, happier reps who are learning.

## 2. Governing clauses (the framework this build is bound by)

- **AMD-006 §1.5.1 four-layer sieve** (build order, foundation-up): (1) structure efficiency → (2) operational
  effectivity (works end-to-end) → (3) synergetic composition (workflow continuity) → (4) UI/design. Fails any of
  1–3 → not shippable. Plus proactive-audit (THINK then search).
- **A18 (primary asset for this build):** surfacing human-behavior data to a leader — *the LABEL is the structural
  defense against misuse.* "Underperforming/struggling" invites comparison/penalty; "Needs Guidance / growth area"
  invites mentorship. The PDF's stated purpose (help the struggling, replicate the winning) IS A18's own test.
- **A10 (no shadow read):** the rep must have a UI surface to see the *same* data the manager sees about them.
- **A11 (mirror, don't judge):** verdict-shaped output ("good/better/worse") must be redesigned into a
  count-plus-question mirror.
- **§3.5 / §3.6:** measurement anchored to real consequence, never fabricated/guessed ("no instant results —
  honesty is the moat"); visibility serves growth, not surveillance.
- **§3.3 / A8 / A9:** guide-don't-overtake; the System is a growth participant; the builder's submission to the
  discipline IS the credibility (this build is itself a test of that).

## 3. Understanding (agent's words; founder to confirm it is the spec, not a reinterpretation)

Standard web mode only, Expert untouched. **Sessions tab** → erased → roster of team members → click a name →
that member's profile → their recordings from the past 2 days; recordings auto-delete after 2 days unless saved
(manager or rep). **Analytics section** → ELO/aggregate removed → roster → click a name → profile page with
strengths, growth areas, and A+/A/A- scores for the six named dimensions. Purpose: manager transparency to coach
via data and replicate winners.

## 4. OPEN conflicts & ambiguities — surfaced, NOT resolved (awaiting founder ruling)

- **① [LOAD-BEARING] Letter grades vs A11.** PDF mandates `A+/A/A-`; A11 forbids verdict-shaped output. Options:
  (a) grades exactly as written (founder explicitly overrides A11 for this manager surface); (b) the six
  PDF-named scores on the A-scale, framed as coaching targets with the underlying countable behaviors shown
  (satisfies PDF letter + A11) — **agent recommendation**; (c) founder variant. **STATUS: OPEN.**
- **② A10 self-view.** Manager-only read = shadow read unless the rep sees the same data. Rec: rep retains a
  self-view (the current self-coaching surface becomes it). **STATUS: OPEN.**
- **③ A18 labels.** "Struggling" + low grades invite penalizing. Rec: same data, labeled growth areas/strengths,
  grades as coaching targets. **STATUS: OPEN.**
- **④ Where do reps start/record sessions?** Sessions tab becomes manager-facing; recordings must originate
  somewhere. PDF silent. **STATUS: OPEN.**
- **⑤ ELO (§3.5 hard metric).** "Take all out" — keep computing it (hidden in Standard) or delete for Standard?
  **STATUS: OPEN.**
- **⑥ Manager role + roster visibility.** Does a manager-vs-rep distinction exist; are these tabs manager-only in
  Standard? (Code-map pending.) **STATUS: OPEN.**
- **⑦ Retention mechanism.** 2-day auto-delete + `saved` flag — cron purge vs TTL; depends on existing recording
  storage (code-map pending). **STATUS: OPEN (design rec to follow).**
- **⑧ One unified rep profile vs two.** Both tabs open "a profile"; is it one profile (recordings+scores) via two
  doors, or two distinct pages? Rec: one unified profile. **STATUS: OPEN.**
- **⑨ Score data source + honest-empty floor (§3.5/§3.6/A11).** The six grades need real analyzed-recording data;
  a rep with too few sessions shows "still accumulating," not a confident grade. Do the six dimensions map to
  existing skill analysis or is new analysis in scope? (Code-map pending.) **STATUS: OPEN.**

## 4b. Code map — current state (read-only exploration, 2026-07-16). Fact-grounds §4.

- **Mode branch:** `profiles.experience_mode` ('standard'|'expert', migration 0110); one source of truth
  `src/lib/experience/mode.ts` + `useExperienceMode()` hook + `<ExpertOnly>`/`<AdvancedDetail>`. **Expert is
  uniformly the `!isStandard` path** → isolation is clean.
- **Sessions tab** = `src/app/dashboard/sales-coach/sessions/page.tsx`. Standard already REMOVES the Start panel
  (Expert-only, 272); reps start/record from **Home** (`sales-coach/page.tsx`). So ④'s answer: reps record from
  Home today.
- **Analytics tab** = `src/app/dashboard/sales-coach/analytics/page.tsx`. **Standard** already renders
  `<SkillScores>` = the six /10 tiles (154); **ELO badge + team-aggregate are Expert-only** (159/199). ⑩: the
  PDF's Analytics screenshot is the Expert view.
- **Recordings:** `coaching_sessions.audio_asset_url` → assets bucket (upload route
  `coach/sales-session/[id]/upload-recording`). Append-only. **NO retention, NO save/keep flag** → greenfield.
- **Skill scores:** `src/lib/coach/v5/skillAnalytics.ts` (pure, tested) → the six PDF dimensions, **/10**,
  **self-only** (`skills/route.ts` uses `auth.uid()`, never a rep param — §A18). Band constants 62-74.
- **Manager role:** `profiles.sales_coach_role` ('admin'|'staff', 0072). "Manager" = company admin OR
  `sales_coach_role='admin'`. Manager-only roster exists: `sales-coach/team/page.tsx` (roles only, no metrics).
  Managers ALREADY see per-rep session visibility (`list/route.ts` 176) + gamified per-rep ELO (coach-assessment).
  Skills + after-pitch rubric are rep-private. Team-analytics is aggregate-only (403 + shape enforcement).
- **§A18 enforcement points** (must be consciously modified for manager per-rep scores): `team-analytics/route.ts`
  (aggregate-only), `skills/route.ts` (self-only), `list/route.ts` (visibility-not-ranking), analytics/sessions
  page framing banners.

## 5. Expert-mode isolation guarantee (non-negotiable) — CONFIRMED ACHIEVABLE

Map confirms Expert = uniformly `!isStandard`. Enforcement: every change gated inside `isStandard` branches (the
two Standard pages) or new manager-gated API routes Expert never calls; new migration is ADDITIVE (new
column/flag) so Expert reads are untouched; a final `git diff` review proves no Expert render path changed; if a
shared component (`SkillScores`, `SalesCoachShell` nav) can't change without touching Expert, it branches on mode
so Expert output is byte-identical, else STOP + flag.

## 6. File-by-file implementation plan (conditional on §4 rulings; layered AMD-006 1→4)

> This is the requested pre-build plan. It does NOT pre-commit the OPEN conflicts — branch points are marked
> `[dep ①]` etc. Build begins only on founder rulings + approval of this plan.

**Layer 1 — structure / data (foundation):**
- `supabase/migrations/00XX_recording_retention.sql` — add `coaching_sessions.recording_saved boolean not null
  default false` + `recording_saved_by uuid` + `recording_saved_at`. Retention: a query-time filter (recordings
  older than 2 days AND not saved are treated as expired/hidden) PLUS a purge path `[dep ⑦]` (cron vs
  storage-sweep extension — rec: extend the existing `storage-sweep` pattern to null out `audio_asset_url` +
  delete the asset for unsaved recordings > 2 days). Additive → Expert untouched.
- `src/lib/coach/v5/skillGrade.ts` (NEW, pure, unit-tested) — `/10 → A+/A/A-…` mapping `[dep ①]`. Only built if
  ①(a)/(b); under ①(b) it also exposes the underlying counts so the grade reads as a coaching target (A11).

**Layer 2 — operational effectivity (per-rep data to manager, done right):**
- `src/app/api/coach/sales-session/skills/route.ts` — add a manager-scoped variant: a manager (company-admin OR
  sales_coach_role=admin, SAME company) may pass `?agentId=` to read that rep's six scores. **Consciously edits
  the §A18 self-only gate** `[dep ②,③,⑥]`. A10: rep keeps the existing self-view (unchanged). A18: response
  labeled growth-areas/strengths, not "underperforming".
- `src/app/api/coach/sales-session/[id]/save-recording/route.ts` (NEW) — manager OR owning rep sets
  `recording_saved` `[dep ⑦]`.
- Recording list for a rep (past 2 days, manager-visible) — extend `list`/session-detail access (managers already
  have per-rep session visibility) to expose `audio_asset_url` for the rep's last-2-days sessions `[dep ⑥]`.

**Layer 3 — synergetic composition (the Standard tabs become roster→profile; workflow continuity):**
- `src/app/dashboard/sales-coach/sessions/page.tsx` — under `isStandard`, replace the self-history view with a
  **team roster** (reuse the roster data from `team/page.tsx`) → click a rep → **rep profile (recordings, past 2
  days, save toggle)**. Expert `!isStandard` branch UNCHANGED. `[dep ④,⑥,⑧]`
- `src/app/dashboard/sales-coach/analytics/page.tsx` — under `isStandard`, replace `<SkillScores self>` with the
  **team roster** → click a rep → **rep profile (strengths, growth areas, the six graded scores)**. Expert
  ELO/team-aggregate branch UNCHANGED. `[dep ①,③,⑤,⑥,⑧,⑨]`
- Shared rep-profile component `src/components/sales-coach/RepProfile.tsx` (NEW) if ⑧ = one unified profile
  (recordings + scores + strengths/growth), reached from both tabs. `[dep ⑧]`
- Continuity (AMD-006 L3): after a manager views a rep, the next obvious action (coach them / open a recording)
  is present; no dead-end empty states; a rep with too few sessions shows honest "still accumulating" not a
  fabricated grade `[dep ⑨]`.

**Layer 4 — UI/design (A18 labels are the structural defense, not cosmetics):**
- Roster + profile styling consistent with `SalesCoachShell`; labels invite coaching (A18 3-question test applied
  to every grade/strength/growth label); the rep-self-view disclosure (A10) that "your manager can see this to
  coach you, and you see exactly the same."

**Tests (CI-runnable, per this session's discipline):** `skillGrade.test.ts` (the /10→letter mapping, incl. the
honest-empty floor) `[dep ①]`; retention filter unit test; a manager-authz test on the skills `?agentId=` route
(a non-manager / cross-company caller is rejected — §A18/A10 boundary).

**Expert-untouched verification (final step):** `git diff` review confirming zero change to any `!isStandard`
branch, Expert-only file, or Expert API path; Expert Analytics still renders ELO + team-aggregate; Expert
Sessions still renders the Start panel. Report in §7.

## 7. Honest build report

> PENDING build. Will contain: file-by-file what was built, which clause each part satisfies, what could not be
> completed, anything changed from the spec and why, anything untested ("untested" stated plainly).
