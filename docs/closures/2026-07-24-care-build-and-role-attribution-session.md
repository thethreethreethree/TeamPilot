# Session closure — 2026-07-24 · Vercel build fix + C.A.R.E build cycle + role-attribution sweep

One-page map of a long multi-thread session. All commits are on `main`, `tsc` clean, full suite
**1367 passing / 15 skipped** (0 failures, re-run at close). Detail lives in the linked docs; this is the map + the
decision list + the session-read manifest.

## 1. Vercel 45-min build TIMEOUT — diagnosed + fixed
Root cause (by elimination): `@sentry/nextjs` build-time source-map upload with
`widenClientFileUpload: true`, which runs only when `SENTRY_AUTH_TOKEN` is set (Vercel prod, not
local) — exactly the local-30s / Vercel-45min split. Fixed → `widenClientFileUpload: false`
(`9e9c842f`). Reverted a first mis-diagnosis (typecheck/lint skip) per §2 (`1a37e36e` — `eslint` is
an unrecognized key on Next 16 + it removed a safety net). Reconciled with the parked Node-pin bundle
(complementary, not redundant). **Founder: confirm from the next build log which phase dropped
(`Sentry - Uploading source maps` vs `Installing dependencies`).** Also surfaced: `middleware`→`proxy`
Next-16 deprecation on the auth gate (queue 8f) + extracted/tested the auth-gate decision (`routeGuard.ts`).

## 2. C.A.R.E Build→Audit→Remediation cycle (founder's strict protocol) — 4 stubs built
Pre-build: quoted governing clauses (incl. AMD-006 in full), stated understanding, surfaced conflicts,
got scope confirmation ("Everything, Monitor first"; "apply everything you can"; anonymous presence).
- **Live Monitor** (`b0fae5fa`) — heartbeat→row→poll (A16/A28, the `care_agent_state` precedent), NOT
  Supabase-realtime; migration `0192` (UNAPPLIED); anonymous presence-only (§3.4). Host-page accuracy
  via host↔iframe postMessage (`98da03a2`).
- **Decision Dialogue** (`203d3ad5`) — dead link → real page + IDOR-scoped `decision-seed` + pure
  `decisionSeed.ts` (seeds Situation with the customer's words, §3.3).
- **Read-receipts + §A11 aggregator** (`7fb4f307`) — aggregator counts-only + threshold-gated
  (A11/§3.2/§3.5). **Read-receipt post-audit correction** (`f5d256ed`): the dot could never light
  (no collapsed-state poll) AND was missing on the customer-facing widget (A21) → fixed both.
- **Audit A1-A5** (`e2f3103e`): A1 presence rate-limit (MED, class-checked A21) + A3/A4/A5 fixed;
  A2 documented. **PDF: `docs/CARE-COMPLETION-2026-07-24.pdf`** (Chrome headless).
- IDOR route tests for both new endpoints (`0dcdf66d`, `19ee80f5`).

## 3. Spawn Task role-attribution (founder re-report) — fixed + class-swept
Founder screenshot: Spawn labeled the C.A.R.E user (John) as the CUSTOMER. Root cause (§2): Spawn
dumped the whole scanned thread as `author:"Customer conversation"` with no agent anchor — MISSED by
the 2026-07-23 "universal" fix (which was NOT universal; that memory claim corrected). Fixed
(`86bc7254`): agent-name lookup + WHO-IS-WHO anchor (parity with copilot, A28) + neutral label.
**Class sweep (A26):** Formulate had the same gap → fixed (`2a269afb`); all write-AS-agent tools
(copilot/spawn/formulate) now anchored. Coach/summarize/dissect (describe/grade, lower risk) surfaced
as a lower-priority follow-up. Anchor locked by tests (`56b4482a`).

## 3b. Continued audit + fixes (after this closure was first written)
A long proactive-audit continuation (AMD-006) traced shared logic surface-by-surface and found real
defects in the less-exercised code, then verified the well-trodden paths sound:
- **Email channel — 3 real bugs** (least-exercised parallel of the widget): context-blind AI
  (`recentTurns:[]` → thread history + shared `buildRecentTurns` helper `2c22d279`); AI replies
  **stored but never emailed** (`dispatchOutboundEmailReply` wired `80bc1b5a` — needs Postmark +
  founder auto-email-posture confirm); empty-handoff silence (`78bbce10`, locked `dc9eac88`).
- **Extension** — stale-context truncation (`slice(0,N)`→`slice(-N)`, kept oldest not recent,
  `9ae8cd2d`); **role-attribution class FULLY closed** — Dissect added (`2248a188`/`3a707f51`), all
  6 tools now anchored + regression-tested.
- **Sales Coach** — attribution verified sound (no REP/CUSTOMER inversion); **debug-leak fixed**
  (`c4097237`, internal/error strings in prod responses, class-swept isolated).
- **Built:** widget traffic + wrong-origin (token-abuse) visibility (`e0af75af`, was a Sprint-7 stub);
  Monitor session-duration ("on site 4m", `f87227f1`).
- **Correctly REJECTED** (§2/§5): the "no-numbers" widget cost-cap interim — it's per-IP, would throttle
  shared-NAT tenants; needs volume data like the per-tenant cap (`756d5aa5`).
- **Verified sound** (launch invariants, both products): §3.1 event-immutability system-wide, §3.2 gate,
  CSV injection, CRM authz, care-config prompt-injection (admin-only writes), embed snippet, multi-tenant
  routing, LLM-route rate-limiting, voice per-call cost caps, onboarding continuity, CWS store-package
  freshness, all-6-tools-wired. Authz tests added for all 4 new endpoints.
- Full suite green throughout (1356); `tsc` + `next build` clean.

## 3c. Continued (guard-driven) — one build, one test-lock, honest corrections, a verification sweep
Further proactive continuation after 3b. One genuinely new build; the rest hardened or confirmed strength:
- **BUILT — RFC 3834 automated-sender suppression** (`38dbe0de`): once Postmark is live the AI auto-emails
  inbound customers → the classic auto-reply-loop class. The count-based loop breaker only trips after ~5
  machine hops; the new pure `detectAutomatedSender` (11 tests) stops it at hop 0 on `Auto-Submitted!=no`,
  `Precedence: bulk/list/junk`, `List-Id`/`List-Unsubscribe`, and no-reply/daemon senders. Wired before the
  LLM call; does NOT flip `ai_responding` (a human may reply next); appends `ai_suppressed_automated` (schema
  verified — `event_type` is free text, `actor_type='system'` in the CHECK set). Surfaced to the agent with a
  human label (`3d0d7298`). Runbook **E4** documents it + a veto. Conservative by design (a false positive
  silences a real customer — the human-passthrough tests are load-bearing).
- **Test-lock — Co-Pilot role anchor** (`946cfd98`): it was the only 1 of the 6 tools whose WHO-IS-WHO anchor
  had no test, and the highest-risk (original tool, the "Hi John" fix, drift-prone duplicated wording). Now
  6/6 test-locked.
- **Honest corrections (§5):** the `renderEventLabel` switch is COMPLETE for all 11 event types actually
  written to `support_conversation_events`; an earlier commit's "fall-through" flag was grep noise, retracted
  on the record (`7ae77847`). Deliverable-staleness class closed: completion PDF §2b (`c4b59b47`) + runbook
  X1/Dissect + E4 (`e80fb0d0`) refreshed to final state.
- **Verification sweep — all confirmed strong (no change):** the **entitlement write-path plan** re-verified
  accurate against HEAD (`8daef05c` — A1 read logic, care/CRM plan enums, B1 route, panel copy); the
  **extension paywall** is airtight — one shared `guardExtensionRequest` gates all 6 routes (entitlement
  before any paid compute), test-locked at source; the **empty-product-context first-run** is safe (anti-
  hallucination rules live in always-present `buildIdentity` → unconfigured tenant hands off, never
  hallucinates); double-entry balance is DB-enforced (deferred constraint trigger). The FX per-line rounding
  money-bug stays correctly held for a founder accounting decision.
- Full suite green; `tsc` clean throughout.

## 4. OPEN — founder's calls (nothing else blocking)
1. **Apply migrations `0188`–`0192`** + **browser-verify** all cycle-1 features AND the Spawn draft
   (all `tsc`+unit-tested but end-to-end UNTESTED — §5, completion is the founder's confirmation).
2. **Entitlement write-path A1+B1** — THE launch blocker; pricing decision (say the word).
3. Per-tenant AI-cost cap (numbers), AI human/AI disclosure (legal), embeddings upgrade, durability
   auto-resolve worker — all in the completion PDF.
4. Read-receipt collapsed-poll: reversible-flagged (background polling for active-conversation
   visitors) — veto if unwanted.

## Session-read manifest (A22)
CLAUDE.md, ThinkerThinker.md (full), AMD-006 (full) — all read this session 2026-07-24. Governing
clauses applied: §0, §2, §3.1–§3.6, §5, AMD-006 (four layers), A11, A14, A16, A21, A26, A28, A34, A39.
