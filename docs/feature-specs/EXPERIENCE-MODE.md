# Experience Mode (Standard / Expert) — the per-user complexity dial

**Status:** in progress (skeleton across all four AMD-006 layers built + statically green; NOT runtime-verified). Started 2026-07-09.
**Migration:** `0110_experience_mode.sql` — **UNAPPLIED**.
**Governed by:** CLAUDE.md §0/§0.1, §1.5.1 (AMD-006 four-layer framework), §2, §3.3, §3.4, §3.6; ThinkerThinker.md A8, A13, A16, A17, A18, A28.

---

## Why

Consistent business-partner feedback: the system is **too complex / overwhelming** — information overload and paralysis, especially for Customer Agents and Sales Agents (§1.1 data-as-asset: a repeated signal is a pattern, not noise).

## What it is (founder-confirmed decisions, 2026-07-09)

A **single system with a per-user complexity dial**, NOT two parallel apps (two apps = double maintenance + drift; the dial makes "apply to ALL surfaces" actually achievable). Mirrors the existing Learning Mode preference (§A28 precedent).

| Decision | Choice |
|---|---|
| Architecture | **One dial**, one codebase, two user-facing experiences |
| Who sets it | **Per-user** (overload is per-person) |
| Default | **Standard** for new users; **existing users backfilled to Expert** (today's behavior unchanged for them) |
| Standard depth | **"Mostly just the answer/action"**, minimal "why" — with full detail **one click away** (drill-in preserved; §3.3/§3.4) |
| Scope | **Both** AI-output verbosity **and** UI disclosure, **all** surfaces, incl. C.A.R.E + Sales Coach |
| Agent vs customer (§A17) | Standard simplifies what the **agent reads** (coach/dissect/summary). Messages the agent **drafts to send** (co-pilot reply, formulate, chat guide) stay **full quality** — a customer must not get terser support because their agent chose a simpler UI |

## Architecture (foundation-up, AMD-006 layers)

**Layer 1 — structure**
- `profiles.experience_mode` (`'standard'|'expert'`), migration 0110. Backfill without an `UPDATE`: add defaulting to `'expert'` (existing rows), then flip the default to `'standard'` (future rows) — idempotent-safe (§A12).
- `src/lib/experience/mode.ts` — **single source** (§A13): the type/literal/default, `modeDirective()`, `shapeSystemPrompt()` (with the JSON-safety guard), `getExperienceMode()` server reader (fails safe to standard).
- `/api/me/experience-mode` GET/PATCH (mirrors `/api/me/learning-mode`).
- `ExperienceModeProvider` + `useExperienceMode()` — client read for UI gating, mounted in `dashboard/layout.tsx`.

**Layer 2 — AI content**
- **Central injection** at `llmCall`/`llmStream` (the one chokepoint every AI call funnels through): they call `shapeSystemPrompt(prompt, mode, {expectJson})`, appending the Standard directive so EVERY surface that threads its mode simplifies consistently (§A16).
- **JSON-safety guard (§A14):** a `expectJson:true` call is returned UNCHANGED — the "drop structure, 2-3 sentences" directive would make the model return prose and break the parse. JSON surfaces need per-FIELD prompt edits instead.
- `experienceMode` threaded through the shared helpers: `runBrainCall`, `runBrainStream` (brain), `call()` + `generateCareReply` (claude.ts). Each route passes the acting user's mode; a surface that doesn't stays Expert (no silent break).

**Layer 3 — UI disclosure**
- `AdvancedDetail` primitive: Expert renders children inline; Standard collapses them behind a one-click "show more" reveal (the drill-in). Inert until applied to surfaces.

**Layer 4 — toggle**
- `ExperienceModePanel` — Standard/Expert selector, mounted in main Settings + Sales Coach settings + C.A.R.E settings. Copy is §A8/§A18-disciplined (a growth choice, not a "lite version").

### Composition with Learning Mode (AMD-006 layer-3 synergetic trace, 2026-07-09)

The obvious composition worry: Experience Mode Standard = *less* teaching, Learning
Mode = *more* teaching — do the two per-user dials contradict (§A16)? **Traced from the
code; they compose cleanly, no conflict.** They operate on different objects:

- **Learning Mode** (`LearningHint`, gated by `useLearningMode().shouldRender`) is a
  client-side, **opt-in, hover-triggered** overlay teaching about the **product's UI
  features** (meta-level: "what is this Dissect?"). It is dormant until the user turns it
  on and hovers. It does **not** touch LLM prompts.
- **Experience Mode** Standard simplifies **AI-generated content** length (object-level:
  the answer itself) + (future) collapses advanced detail.

A Standard user who *also* enables Learning Mode is coherently asking "give me simple AI
answers, but let me hover-learn the product" — orthogonal concerns, both opt-in, no
silent fight. The one soft edge — the pulsing hint outlines add visual load, against
Standard's reduce-load intent — is gated behind the user's **own explicit** opt-in to
Learning Mode, so it's a chosen combination, not an automatic contradiction. When the
render-layer lands: a collapsed advanced element that carries a `LearningHint` simply
reveals both the detail and its hint on the one-click expand (the §A17 valve) — still
coherent. **No remediation needed; recorded so the composition question is closed, not
re-litigated.**

## Build status (honest)

| Piece | Static-verified (tsc/lint/unit/theme) | Runtime-verified |
|---|---|---|
| 0110 migration | rls-audit green | ❌ unapplied to any DB |
| mode.ts (+13 unit tests) | ✅ | n/a (pure) |
| route GET/PATCH | tsc/lint + **9 handler tests** | ❌ never hit live, BUT the DB write-path is **source-verified**: the 0090/0091 profiles guard is a blacklist (freezes only role/company_id/sales_coach_role/is_support_agent) so `experience_mode` passes, and RLS self-update is the same path Learning Mode uses in prod |
| provider | tsc/lint | ❌ never rendered |
| central LLM injection + JSON guard | ✅ pure-transform tests **+ 6 injection integration tests** (llmCall/llmStream append the directive for Standard prose; don't for JSON/expert/unset; providers mocked) | ❌ no *real provider* call / live prompt |
| summarize threaded (1st prose surface) | tsc/lint + **thread source-verified end-to-end (2026-07-09)**: route:111 `getExperienceMode(sb, agentId)` → :116 `generateCareReply` → claude.ts:634 `call({experienceMode, expectJson:false})` → call:40 companyId→brain branch → :46-48 forwards both → `runBrainCall`:304 → `llmCall` → `shapeSystemPrompt(prompt,"standard",{expectJson:false})` → guard doesn't fire → Standard directive appended. Every hop confirmed from source | ❌ no live prompt — the WIRING is verified; the remaining unknowns are the live mode-read + the real provider honoring the directive (the founder's smoke-test step 3) |
| AdvancedDetail | tsc/lint/theme | ❌ no component-test harness in repo |
| toggle panel ×3 | tsc/lint/theme | ❌ never clicked |

**Nothing has been exercised against a live DB, LLM, or browser** (can't be done headless). All changes are inert/no-op until 0110 is applied AND a user selects Standard, so shipping-safe — but real behavior is UNCONFIRMED.

## How to activate + test (founder)

1. Apply `0110_experience_mode.sql` to a dev/staging DB.
2. Open Settings → flip Experience Mode to **Standard** (persists to your profile).
3. In C.A.R.E, run **Summarize** on a conversation → the summary should come back short/plain (the first threaded surface). The co-pilot **reply** should stay full quality (the §A17 split).
4. Report back what you see — that runtime feedback de-risks the JSON per-field work below, which I cannot verify headless.

## Governing rule found by self-audit (2026-07-09): EPHEMERAL vs STORED outputs

An AI output simplifies at a different LAYER depending on whether it's stored:

- **Ephemeral** (generated on-demand, returned to the requesting agent, not stored
  or shared) → simplify at **GENERATION** by threading `experienceMode`. The
  generator IS the viewer, so their mode is correct. Example: **C.A.R.E summarize**
  (returns the summary, stores nothing) — threaded, correct.
- **Stored / shared** (written to the DB as an event/row, read later by possibly a
  DIFFERENT user) → do NOT shape at generation (a Standard generator would store a
  short artifact an Expert later sees). Keep the stored artifact **canonical/full**
  and simplify at the **RENDER/VIEW** layer per the viewer's mode (Phase 3:
  `AdvancedDetail` + conditional field display). Examples: **salesSummary**
  (`runAndStoreSummary`, stores a `coach.session_summary_generated` event — left
  UNthreaded, correct), dissect, review, coaching artifacts.

**This resolves the JSON blind-risk:** the JSON surfaces (coach analysis, dissect,
review) are also stored/structured, so they simplify at RENDER — I never touch
their JSON prompts, so there's no schema-break risk to verify. The remaining AI
work is therefore mostly render-layer (Phase 3), not prompt-layer.

## Remaining work (large — sequence is a founder call, "all means all")

- **Render-layer simplification (the bulk):** the stored/JSON agent-facing surfaces
  (salesSummary, dissect, review, coach analysis, why, score, outside-view,
  ripple-trace) simplify at the RENDER layer per the ephemeral-vs-stored rule
  above — show the key field(s), collapse elaboration behind `AdvancedDetail`. No
  prompt/schema risk. **CAUTION (self-audit 2026-07-09): this is NOT safe to do
  blind.** Attempting the diagnose page showed its "outside views" / "ripple
  trace" are PRIMARY WORKFLOW content, not collapsible elaboration — collapsing
  them would break the diagnostic flow. Distinguishing supplementary-elaboration
  from load-bearing-content requires per-surface runtime judgment, so each surface
  must be reviewed against a live render, NOT swept mechanically. Do this WITH
  founder runtime review, surface by surface.
- **Remaining ephemeral prose surfaces:** enumerated all 8 `generateCareReply` callers
  (2026-07-09). C.A.R.E summarize is threaded (agent-facing). The four customer-facing
  callers (co-pilot, formulate, messages, inbound-email) correctly stay full (§A17 —
  a customer must not get terser support for their agent's UI choice). **Correction to
  an earlier "none left" claim:** two MORE agent-facing ephemeral coach drill-ins exist
  and are currently unthreaded — `coach/sales-session/ask-coach` and `dissect/ask-coach`
  (both return prose to the agent, store nothing). They're the same "agent asks the coach
  to explain" character as `ask-jeff`, so they're flagged as the same founder decision
  below, not silently left out.

## Open decisions flagged (not resolved silently)

- **`ask-jeff`**: left at FULL detail. It's the explicit "teach me more" drill-in invoked from Learning Mode — simplifying it fights its purpose (§A17). Override if you want it simplified too.
- **The two coach drill-ins (`coach/sales-session/ask-coach`, `dissect/ask-coach`)**: same class as ask-jeff — the agent actively asks the coach to explain something, so a Standard agent might want *either* a simpler answer (thread the mode) *or* the full teaching depth the drill-in exists to give (leave as-is, like ask-jeff). Currently unthreaded (full). Both are ephemeral agent-facing prose (verified: return prose, store nothing), so if you want them simplified the fix is a one-line `experienceMode` thread each (like summarize), NOT a render-layer change. Your call — I did not thread them blind because "simplify a drill-in the agent chose to open" is a genuine §A17 judgment, not a mechanical gap.

## Commits (2026-07-09)
`b2e5b7b` foundation · `bfa5449` central injection · `d5dbe08` shared-helper plumbing · `9d8966b` JSON-safety + summarize · `6b127d2` toggle ×3 · `be00e35` AdvancedDetail primitive.
