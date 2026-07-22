# Ground-up audit cycle — 2026-07-22

Founder directive (2026-07-22): "Audit the system from the ground up. There are bugs everywhere in
the system, both structurally and visually (Graphic, and user interface)." Continue until the
command **STOP AUDIT CYCLE**.

Method: §1.7 ground-up (foundation → presentation), AMD-006 four layers, §1.2 retrospective
pattern-detection (fix the class, not the instance), §3.4 honesty (no fabricated findings; a
suspected bug that measurement disproves is recorded as disproved).

Baseline (this session): `npm run check` fully green — 0 typecheck, 0 lint, 0 theme leaks, 0 RLS
gaps, 0 invariant violations, 910 tests pass. So the foundation layers (env, toolchain, types,
schema, RLS) are sound; findings live in higher layers (effectivity, presentation).

---

## Fixed + deployed

### F2 — Care voice settings were dead (MED) — FIXED `cd1ecc2e`
`care_tenant_config.aiTone` / `aiResponseLength` were loaded from the DB but never passed to
`buildCareSystemPrompt`, so the tenant's tone/length selection did nothing. Founder decision: wire
them in. Now threaded through both callers (messages route + inbound email route) with an explicit
TONE & LENGTH directive; defaults reproduce prior behaviour. §A5 (config flag reaches its consumer)
/ AMD-006 Layer 2.

### V1 — Comparison C.A.R.E column hidden on mobile (MED, Layer 3/4) — FIXED `e35765b8`
`/care/demo` comparison was a `min-w-[640px]` table in an `overflow-x-auto` card; on a phone the
C.A.R.E column (the section's punchline) sat off-screen. Fixed: table on md+, stacked cards on
mobile with C.A.R.E always visible + emphasized. Verified by CDP device-emulation render (390px).

**Honest correction (§3.4):** I first suspected a page-wide horizontal-overflow bug (content looked
clipped in a `--window-size` headless screenshot). Direct CDP measurement disproved it —
`document.scrollWidth == viewport (390)`, zero overflow offenders. The clipping was an artifact of
the `--window-size` screenshot method, not a real bug. No page-overflow fix was needed. Retained a
defensive `overflow-hidden` on the hero for the 600px decorative glow (ripple-traced vs the sticky
header, §1.5).

**Tooling note:** `--window-size` headless screenshots are unreliable for mobile-viewport checks.
Use CDP `Emulation.setDeviceMetricsOverride` + `Page.captureScreenshot` (scripts in scratchpad:
`measure.mjs` finds overflow offenders, `shot.mjs` captures an accurate device render).

### V2 — PWA install banner overlapped by global FABs (MED, Layer 4) — FIXED `ea33421d`
The `InstallPrompt` banner (both native-deferred + iOS branches) was `fixed bottom-4 z-50`. The two
global FABs — Care chat (`bottom-4 right-4 z-55`) + Feedback pill (`bottom-4 right-20 z-60`) — share
that bottom row at higher z, so they rendered on top of the banner and covered its own "Not now"
dismiss button, on **both** mobile and desktop (verified by CDP first-viewport render). Fixed: raised
both branches to `bottom-24` to clear the ~72px FAB zone. Desktop fully clean; mobile FAB overlap
gone. Residual mobile tradeoff (banner overlays lower part of the login CTA on short pages) folded
into decision A2.

Note: the native-deferred branch (what fires in Chromium) needed a separate edit — its class string
differed from the iOS branch, so the first `replace_all` only caught one. Caught by re-rendering and
seeing no change (§2 — a fix that doesn't change the result means the identification was incomplete).

---

## Open — founder decision

### A2 — Pre-auth chrome density on /login (LOW, product) — DECISION
On the mobile login page a first-time visitor sees the login form + the PWA install banner + the
Feedback FAB + the Care/Jeff chat FAB — four competing pieces of chrome, three of them bottom-anchored.
V2 stopped them overlapping, but the density itself is a product question. Notably the Feedback FAB
pre-auth just routes to /login (per its own comment), so it does little before login. Options:
(a) hide the PWA install prompt + Feedback FAB on auth pages (keep Jeff, who a prospect might use);
(b) keep all, accept current stacking; (c) keep install + Jeff, drop Feedback pre-auth (recommended).
Not decided unilaterally — §3.3.

### A1 — Per-company `llm_provider_preference` is a dead setting (LOW, §3.4) — DECISION
Settings → "Preferred provider for this company" writes `companies.llm_provider_preference`, but
`chooseProvider()` (`src/lib/llm/index.ts:40`) reads **only** `process.env.LLM_PROVIDER` + available
keys — it never reads the stored preference. So the dropdown stores an intent inference ignores.

Mitigations already present: an honest "active provider" panel sits directly above the dropdown and
shows the *real* env-derived provider + reason; helper text says keys are env-controlled. Admin-only,
single-operator surface. Practical harm ≈ 0, but the label implies control it lacks.

Options:
- **(A) Wire it in** — thread the per-company preference into provider selection (honor it when the
  matching key exists, else fall back to env/available). Real architectural change: `chooseProvider()`
  is sync + env-only and called in hot paths without company context; also has cost/routing ripples.
- **(B) Make it honest (recommended, low-risk)** — relabel the dropdown as advisory/"not yet active —
  provider is set by deployment env", or remove it until (A) is built.

Recommend **(B)** now; **(A)** only if per-tenant provider routing becomes a real requirement.

---

## Checked — clean (no action)

- **Care config fields** — all (`replySignature`, `widgetSubtitle`, `companyDisplayName`,
  `aiProductContext`, `widgetLogoUrl`, `widgetGreeting`, `widgetPosition`, `monthlyConversationQuota`)
  reach real consumers; quota is enforced at `conversations/route.ts:108`, logo in widget bootstrap.
- **min-w table / mobile-hide class** — the other `min-w-[…]` tables (admin coach-readout, crm,
  operations, diagnose) are all internal data tables with proper `overflow-x-auto` wrappers;
  horizontal scroll is acceptable UX for dense internal data. The demo case was the one genuine
  instance (marketing punchline hidden) and is fixed.
- **`/api/settings` PATCH** — zod-typed, `.strict()`, tenant-scoped; prior A21 finding already fixed.
- **`/api/coach/sales-session/settings`** — read-only GET, real corpus state (§3.4), no dead writes.
