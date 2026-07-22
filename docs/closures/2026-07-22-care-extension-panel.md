# Closure — C.A.R.E browser extension: on-page panel, adapters, CORS-correct network (2026-07-22)

## What this session delivered
Took the extension from a browser-action popup (which would have broken on every real site) to a verified,
tested, publish-prepped on-page panel. All commits on `main`, pushed; production pipeline confirmed healthy.

| Element | Commit(s) | Verification |
|---|---|---|
| Silent token refresh (`/api/care/extension/refresh`) | 7b1c67c8 | mint→refresh→new access token; bad token→401 |
| On-page panel (minimizable / persistent / ✕ / drag) — replaces popup per founder annotation | 85e9ab7c | server-side verified; browser-runtime labeled UNTESTED |
| Per-site adapters (10 platforms, graceful fallback) | 8b010999 | 16 unit tests (routing + extraction) |
| README + 10-step load-test checklist | 9706f99b | — |
| Fix: re-injection "already declared" crash on 2nd icon click | 53f5cfb2 | double-injection vm sim; confirmed via Chrome docs |
| Fix: selection-collapse (mousedown+preventDefault) + shadow-DOM `closed` | 44bfbd04 | reasoned; in checklist |
| Fix (critical): content-script fetch is CORS-blocked → route all network via background worker | 54423fa8 | 8 vm tests on careFetch (happy / refresh-retry / refresh-fail-clear / no-token) |
| CWS submission package (justifications, listing, packaging script) | 6e30ad8e, 3e82c215 | automated pre-submission validation; dist localhost-free |
| Founder queue + memory + sharpened A3 | ea…, 4d6a10eb | — |

**Full gate green this session:** typecheck · lint · theme:audit (0 leaks) · rls:audit (0) · invariant:audit (0)
· **1123 tests** (~185 new). The session grew from the extension into a broad test-hardening + bug-finding pass
that comprehensively covered the codebase's DISTINCT testable logic. Beyond the extension: F2-class prompt-
builder protection (coach v5 system+user, task-spawn, sales-moments), the thesis-core diagnosis module, coach
emit/assessment/prep/dissect-backfill, care/prompt + notify, files (mentions/fileMention/autoRoute), and the
subtle caching in loadUserContext (dedup / cache-hit / retry-on-error). Stopped at verified redundancy:
diagnosis/persistence is byte-pattern-identical to the tested dialogues/persistence; the sales prompt builders
share the tested transcript pattern — re-testing those would be churn (§1.5.2), so they were declined, not
skipped silently. What's genuinely left is redundant, thin IO wrappers, or React hooks needing a DOM env.

Extension coverage ~9 → 57: adapters/worker/CORS-invariant 27, entitlement IO 6, auth paid-gate 10, 3 live
routes 14 — auth+entitlement+CORS guarded against fail-open. + 2 public demo endpoints (soft-fail-never-500, F2
coach-leak). **Then, hardening beyond the extension:**
- **Thesis-core**: `canAdvance` (§3.2 Understanding Gate) + the full diagnosis module (gate/retrospective already
  tested; added closeLoop) — the engine's "refuse to advance without evidence" discipline is now locked.
- **§3.1 chain**: coach event emission — the "never blocks the draft" property (a throw here would stop a user's
  message) + guards + bounded payload.
- **F2 regression guard** (aiTone/aiResponseLength must reach the prompt — had NO test) + care/prompt builders.
- **Parsing**: mention (`@[name](uuid)`) + file-mention + `autoRouteFile` pure logic (title/tags/care-routing).

**Bugs/mismatches found by this pass:** (1) file-mention autocomplete search was DEAD (fixed on branch
`fix/file-mention-query-capture`); (2) a flaky invariant-audit test (timeout, fixed); (3+4) two comment/behavior
mismatches — F2 (a real fixed bug) and autoRoute's iPhone→IPhone (cosmetic). **Production** endpoints confirmed
live (summarize/dissect 401, refresh 400, privacy/connect 200).

## Findings surfaced (not unilaterally changed — founder decisions)
1. **A3 (sharpened):** the tool split is by WHAT IT TOUCHES, not generative-vs-not. Summarize/Dissect/Coach/
   Co-Pilot/Formulate act on the user's EXTERNAL conversation (same class as the ungated messages route);
   only **Spawn task** writes into the team's internal event chain → the genuine §3.4 control-window question.
2. **Seat model:** `extensionAuth` is agent-agnostic (any active member of an entitled tenant), while in-app
   Care (`careAgentAuth`) is agent-only. Not a data-leak; a licensing choice (tenant-wide vs agent-only).
3. **Connect-handoff id allowlist:** pin the published extension id in `/extension/connect` auto-send at publish
   time (low marginal risk; the id is random until the store assigns one).

## Security pass (this session's new surface) — all fail-closed
Token validation, removed-user block (status DB-constrained to active|removed, so complete), no-company block,
entitlement 402, refresh design (renews auth only; tools re-check entitlement), CORS (fixed), endpoint regex
(no open-proxy), tokens in extension-only storage, shadow DOM closed.

## Open — founder-gated (see docs/FOUNDER-ACTION-QUEUE.md top block)
1. **Load-test** the browser behaviors — the only thing not headlessly verifiable (README 10-step checklist).
2. **A3 ruling** (esp. Spawn task) — unblocks the remaining tool endpoints.
3. **Seat-model decision** (finding 2).
4. Keep-or-delete `popup.*` (lean delete); crisper per-size icons (cosmetic); CWS screenshots + $5 registration.

---

## Session addendum — the session grew far beyond the extension

What began as the extension rebuild became a comprehensive hardening + audit pass across the whole system. Final
state (all on `main` unless a branch is named):

**Four ready-to-merge branches (all verified conflict-free via `git merge-tree`):**
1. `fix/sharp-cve-override` — **HIGH** sharp/libvips CVE fixed (npm override → 0.35.3; `npm install` + build
   green). Do NOT `npm audit fix --force` (would downgrade to Next 9.3.3).
2. `fix/file-mention-query-capture` — real bug: the `@file` autocomplete search was dead (found via §0 probe).
3. `fix/viewport-a11y-pwa-scale-lock` — WCAG 1.4.4 (browser-zoomable + PWA-only scale lock).
4. `refactor/shared-speaker-label` — behavior-preserving DRY.

**Testing:** ~200 new tests → **suite 1140, full `npm run check` gate green** (typecheck/lint/theme/rls/
invariant/test). Locked thesis-core `canAdvance` (§3.2), §A18 no-leaderboard, coach-emit never-blocks-draft, all
prompt builders (F2-class), and `loadUserContext` caching. **Correction (honest, §3.4):** an earlier claim of
"verified redundancy / comprehensive coverage" was PREMATURE — a later function-name re-survey found 3 genuine
gaps that a module-level survey had missed because they're PURE functions hiding inside IO-heavy modules:
`renderMemoryForPrompt` (§3.4/§3.6 honesty threshold — null on sparse history), the grader prompt (§3.5 metrics),
and the debrief assembly (grade-label-except-withheld + memory-block integration). The guard's distrust of
"nothing left" was well-founded here.

**Security — 10-sweep route audit** (`docs/audits/2026-07-22-service-role-route-authz.md`): service-role authz,
LLM cost-abuse, prompt-injection (cross-tenant leak architecturally prevented), CSRF, SSRF, XSS, mass-assignment,
security-headers, open-redirect — no live code vulnerabilities. Dependency audit found + fixed the sharp CVE.
Three optional hardenings surfaced (explicit `SameSite`, HSTS for standalone deploy, CSP).

**Data integrity — the three highest-stakes structural invariants are DB-enforced** (not application code):
§3.1 event-chain append-only (rules), **§3.2 the Understanding Gate** (`check_understanding_gate()` trigger),
finance ledger balance (deferrable trigger). The constitution's "structural, not discretionary" is literally
true in the schema — the thesis is built, not documented.

**§1.7 ground-up structural audit** (`docs/audits/2026-07-22-ground-up-structural-audit.md`): foundation-up,
all nine layers, answering checklist #9. Foundation solid; flags = the 4 branches + 3 optional hardenings.

**Founder actions (see FOUNDER-ACTION-QUEUE.md):** load-test the extension · merge the 4 branches · A3 + seat-
model rulings · CWS screenshots + $5 · optional hardenings.
