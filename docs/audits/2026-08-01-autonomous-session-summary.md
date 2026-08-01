# Autonomous session summary — 2026-08-01

Scannable record of a long autonomous build/audit session so you can review ~110 commits fast.
**Decisions you need are in `docs/FOUNDER-ACTION-QUEUE.md`** (top box). This file is the "what happened."

## Headline

A systemic client-side re-entrancy corruption class was found, fixed everywhere, and **confirmed to
have already corrupted production** — then five independent adversarial audits + a full security sweep
verified the rest of the codebase is genuinely well-built. Nothing here needs your input except the
founder-gated items called out at the end.

## Bug classes found + fixed (all committed, each gated on `npm run check`)

1. **Re-entrancy / append-only double-write (~25 fixes).** Append handlers guarded only by React state
   double-wrote on a double-click. Fixed on every creator surface: diagnose, decisions, problems, care
   resolution capture, in-thread dialogue, brain (learn/unlock), care inbox + **both customer chat
   widgets**, sales-coach session start + **transcript labeling**, after-pitch, onboarding (**duplicate
   tenant**), redeem, task steps, chat topics. Fix = a synchronous `useRef` latch. An adversarial re-audit
   caught 6 I'd missed (appends via `lib/data` helpers) **and one false "fix"** where I'd used a `useState`
   flag instead of a ref.

2. **Error-as-no-data (8 fixes).** Load failures shown as empty/eternal-spinner. Fixed care/widget,
   finance/statements, care settings (tags/shortcuts/agents), files, search, feedback — each now
   distinguishes a load error from genuine-empty, with retry. Found largely by a 2nd adversarial audit
   after my own sweep wrongly declared the class "dry."

3. **Silent-gap (1 fix).** The decisions "Hybrid" choice invited "describe what you're doing" but had no
   input — hybrid decisions persisted blank. Added the field + a persist gate.

4. **Async/effect (2 fixes).** A chat refresh missing its poll-sibling's cancellation guard (latent) + two
   finance CSV exports leaking a blob URL.

5. **LLM prompt-injection fence (13 call sites).** The ENTIRE sales-coach transcript LLM surface (9 review
   engines) + both roleplay routes fed untrusted CUSTOMER speech to an LLM with no injection fence — a
   2026-07-27 sweep mis-classified `coach/sales-session` as "trusted (agent's own practice)," missing that
   a transcript contains the customer's words. All now fenced with `CONVERSATION_IS_DATA` + a guard test.

## Production data-integrity check (read-only, no data touched)

- 🔴 The transcript double-click bug **already corrupted 12 of 61 coaching sessions** (128 duplicate rows,
  13.8% of all transcript data). Impact traced: **cue KPIs are immune** (existence-Set), talk-ratio scores
  are self-correcting (proportional dup), **only the LLM qualitative summary is skewed.** Cleanup +
  constraint proposal ready: `docs/proposals/2026-08-01-transcript-dedup-cleanup.md`.
- ✅ Every OTHER append chain clean — decisions, resolutions, dialogues, chat/task messages, onboarding
  companies. So the whole re-entrancy class caused exactly ONE prod incident; every other fix is preventive.

## Verified sound (no fix needed)

`verify:live` 23/23 · tenant isolation (5th audit: **zero** cross-tenant exposure across 41 service-role
routes) · inbound-email webhook (secret-gated, address-derived tenant) · CSV formula-injection neutralizer
· localStorage guards · KPI window/NaN guards · async effect cleanup across pollers/streams/media.

## Adversarial audit yield: 6 / 6 / 1 / 2 / 0 (converged)

Five independent subagent audits. The declining curve + the last two verdicts ("exceptionally
well-audited", "genuinely clean") is the signal the codebase is thoroughly covered — but note all five
found real issues my solo sweeps had declared clean. Commission the outside view.

## Needs YOU (founder-gated — details + one-word triggers in the queue)

- **Transcript cleanup** (HIGH) — dedup + `unique(session_id,seq)` migration + regenerate 12 summaries.
- **Onboarding advisory-lock** (preventive) + **`/respond` idempotency** (design) — server backstops.
- **Finance read-path** (62 sites) — shared `fetchJson`/hook refactor (exemplar fixed).
- **FX rounding** (latent) — assert balance in transaction currency before exposing multi-currency.
- Plus the pre-existing 7 product decisions + the thesis-integrity `/diagnose` client-gate flag.

Nothing was applied to prod DB or schema; no migration run. All source changes are committed + green.
