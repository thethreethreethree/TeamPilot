# Session closure — 2026-07-23 · Extension fix (founder-verified) + comprehensive audit

One-page record of a long multi-threaded session. Detail lives in the linked docs; this is the map + the
decision list. Everything below is committed + pushed to `main`, CI-gate green (tsc/lint/rls/invariant/theme +
**1248 tests**).

## 1. C.A.R.E extension — 2 reported bugs FIXED + FOUNDER-VERIFIED

Founder browser test: *"I can type on the box now, and the co-pilot is addressing the response properly."*

- **Can't-type (CRITICAL):** closed-shadow-DOM panel had no keyboard handling → host email-shortcut sites ate
  keystrokes. Fixed with `stopPropagation` on shadow-root key events (never `preventDefault`). Unblocks Coach +
  Formulate. `35e8ab09`.
- **Co-Pilot "Hi John" role-inversion (HIGH):** tools got unlabeled scanned text → LLM misattributed roles. Fixed
  with (2b) route-layer agent anchor — **universal, covers all channels** — + (2a) adapter role-labels for
  WhatsApp + Gmail (fallback-safe). `35e8ab09`, `4c769fc8`.
- **Also fixed:** Coach (whole-thread mislabel → `recentThread`), Summarize (role-awareness), 402 dead-end copy.
- **Class-checked across ALL 11 tool routes** (6 extension + 5 in-app): role-blindness is extension-specific
  (in-app tools get `authorType` from the DB); every site fixed or verified sound.
- **BONUS security fix:** connect-page token-theft (unvalidated `?ext=` handed the refresh token) → pinned to
  `NEXT_PUBLIC_CARE_EXTENSION_ID` (env), predicate extracted + tested. `a5f9abf3`, `be6c828e`.
- Full record: `docs/audits/2026-07-23-EXTENSION-framework-audit.md`. Memory: `project_extension_bugs_fixed_2026_07_23`.

## 2. Comprehensive audit (this session, pre + post extension)

- **Thesis-core §3.1–§3.5** re-validated vs latest migration state; §3.2 fail-OPEN found + FIXED (`0190`, awaits
  live apply); §3.3 gate extracted + tested; FX per-line rounding bug found (real, latent).
- **Cost-metering class** — widget-messages + inbound-email lack a per-tenant aggregate AI-cost cap (2 MEDIUM,
  one fix, awaits per-plan numbers).
- **CI coverage gap** — thesis-core DB-integration tests never run in CI (MEDIUM; proven by the 0190 fail-open).
- **6 gate-uncovered security classes swept** — service-role tenant-scoping, admin/CRM authz, mass-assignment,
  LLM rate-limits (all CLEAN); error-message leakage (VERY LOW — public surface already clean); + full public
  C.A.R.E surface, extension, finance routes, onboarding, security primitives.
- **§3.5 moat metric** verified honest (counts on durable `resolved_at`, not mutable status).
- Full record: `docs/audits/2026-07-23-ground-up-audit-session.md` (executive verdict table at top).

## 3. OPEN — founder decisions (nothing else blocking)

1. **Entitlement write-path = THE launch blocker.** The extension WORKS but every tenant is `locked`. Say
   **`A1 + B1`** (recommended) and I apply `0189` (verified additive + zero-risk) + build the write-path in one
   verified pass. Plan: `docs/feature-specs/ENTITLEMENT-WRITE-PATH-PLAN.md`.
2. **AI-cost cap number** (per-plan) → I wire the per-tenant cap into both cost call-sites.
3. **CI integration job** (ephemeral-DB) → would've caught the 0190 fail-open; needs your CI-cost OK.
4. **Ops:** apply `0188/0189/0190`; `DEEPSEEK_API_KEY` posture; merge the 4 branches (sharp-CVE first); set
   `CRON_SECRET` (§3.5 sweep) + VAPID + `NEXT_PUBLIC_CARE_EXTENSION_ID`.
5. **Lower:** FX fix (accounting), §3.3 schema-hardening, connect-(b) confirmation, login-`next` continuity,
   error-leakage authed-route cleanup (VERY LOW), per-channel 2a labels on request, 5 dead-class visual fixes.

## 4. How to resume

The extension is shippable the moment the entitlement write-path exists. That's item 1 — a one-word `A1 + B1`
from you turns "works in my browser" into "customers can use it." Everything else is verified sound and recorded.
