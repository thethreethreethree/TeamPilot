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

### V3 — Mobile home header clipped the "Request access" CTA (MED, Layer 4) — FIXED `a1db8d87`
The `/` header nav (ThemeToggle + Feedback + Sign in + Request access) was one flex row with no
responsive collapse. At 390px it measured 318px against ~225px available; the primary CTA overflowed
to right:444 (54px off-screen) and rendered clipped ("Req…acce"). Fixed: hide Feedback + Sign in on
mobile (`hidden sm:flex`/`sm:inline`), keep ThemeToggle + Request access (both hidden links →/login,
same as the CTA). Verified: `npm run check` green + CDP re-render shows full CTA, 0 offenders.

### V4 — "learning gapsname" missing space in Coach Assessment intro (LOW, Layer 4 copy) — FIXED `43036d01`
Found by rendering the AUTHENTICATED page. JSX collapsed the literal space between a bold
`<span>learning gaps</span>` and the following "name" → "gapsname". Fixed with explicit `{" "}`
(the same paragraph already used that pattern one line up). Re-render confirms "learning gaps name".

---

## Authed dashboard visual audit (founder-chosen sweep) — batch 1
Rendered the real authenticated surfaces via a minted CDP session (see tooling below):
- **/dashboard (Command Center)** — desktop + mobile: CLEAN. Sidebar collapses to a hamburger on
  mobile, metric tiles stack 2-up, PWA "Install Team Chat" banner is in-flow (no FAB overlap).
- **/dashboard/care/coach-assessment** — my recent build; renders real data (letter grades D/C-,
  learning gaps + book citations, trajectory sparkline). One copy bug (V4), fixed.
- **/dashboard/care/growth ("Your work")** — my recent build; CLEAN, honest trajectory messaging.
- **/dashboard/finance** — desktop + mobile: CLEAN + honest ($0.00 with an explicit "not a
  placeholder" banner). 15-tab bar is in an `overflow-x-auto` container (FinanceNav.tsx:46) — scrolls
  and stays reachable on mobile; `scrollWidth == viewport`, no body overflow.

Net: the authed surfaces audited so far are well-built; only V4 surfaced.

### batch 2 — all CLEAN
- **/dashboard/marketing** — design preview, clearly labeled "illustrative, not derived" + "not wired
  yet / NOT GA" (§3.4). Funnel, channels, campaigns render well.
- **/dashboard/sales-coach** — "Your coaching, made visible"; start-session card + helped-with tiles.
  Clean, focused single-action page.
- **/dashboard/care** — "What the System noticed this week"; §3.6 auto-refresh, §A11-cited counts,
  honest empty states. Clean.

Overall authed finding rate is low — the surfaces the founder uses daily are solid. The cycle's bugs
clustered in PUBLIC/marketing mobile polish (V1–V3) + one copy typo (V4).

### batch 3 — all CLEAN
- **/dashboard/problems** — §3.2 Understanding Gate honestly surfaced + DB-enforced; draft hypothesis
  card. Clean.
- **/dashboard/diagnose (Living Diagnosis)** — the 7-step constitutional loop (§1.1→§1.6/§3.2/§3.3)
  with real signal data + gated advancement. Excellent.
- **/dashboard/team**, **/dashboard/dissect** (my build; clean input state), **/dashboard/care/
  conversations** (full agent workstation — the real C.A.R.E toolbar the /care/demo showroom mirrors;
  §0 Read-Phase gate; Jeff→handoff thread). All clean/well-built.

### mobile-overflow sweep (390px) — all CLEAN
diagnose, problems, team, care/conversations, care/patterns, care/analytics, settings — every one
`bodyOverflow: false` (scrollWidth == viewport). offCount>0 cases are contents inside `overflow-x-auto`
scroll containers (tab bars / rows), not page breaks.

### nav-link integrity — CLEAN
Extracted every href from Sidebar + CommandPalette; all 29 resolve to real route files. (My earlier
"/dashboard/living-diagnosis 404" was a wrong URL GUESS on my part — the nav correctly uses
/dashboard/diagnose. Recorded honestly, not as a bug.)

---

## Cycle verdict (honest)
Audited ~15 surfaces (3 public + 12 authed) at desktop + mobile, plus an overflow sweep and nav-link
check. **The app core is genuinely well-built** — honest empty states, §-cited copy, responsive
sidebar→hamburger, DB-enforced gates, faithful tool composition. The cycle's real defects were 5:
F2 (dead Care voice setting), V1–V3 (public/marketing mobile visual), V4 (one typo) — all fixed +
deployed. A low finding-rate here is credible because the search was deep (rendered + measured), not
shallow. Cycle remains OPEN until the founder says STOP AUDIT CYCLE.

---

## Reusable tooling (this session)
- Authenticated headless render: no server auth-callback route exists, so mint a session via the
  Supabase admin API (`/auth/v1/admin/generate_link` type=magiclink → `/auth/v1/verify` token_hash →
  access+refresh tokens; the Auth API over HTTPS IS reachable even though direct Postgres is not),
  build the `@supabase/ssr` 0.10.3 cookie (`sb-<ref>-auth-token` = `"base64-"+base64url(JSON.stringify(
  session))`, chunked at 3180 into `.0/.1`), inject via CDP `Network.setCookie`, then navigate. Script:
  `authshot.mjs` in scratchpad. Pass URL paths with `MSYS_NO_PATHCONV=1` (Git Bash mangles `/dashboard`).
- `--window-size` headless screenshots are UNRELIABLE for mobile-viewport checks — they don't set a
  true CSS mobile viewport and produce phantom right-edge clipping (this caused the V1 false-positive).
- Accurate method: drive Edge via CDP (`--remote-debugging-port=9222`), `Emulation.
  setDeviceMetricsOverride`, then `Page.captureScreenshot`. Scratchpad scripts:
  `measure.mjs` (lists elements wider than viewport + reports scrollWidth), `shot.mjs`/`shot2.mjs`
  (accurate device screenshot, beyond-viewport), `shot-fv.mjs` (true first-viewport, correct `fixed`
  placement — required to judge FAB/overlay collisions). Node 24 has global `WebSocket`, no deps.

---

### V5 — Global FABs leaked into the customer-facing embedded widget (MED-HIGH, Layer 3/4) — FIXED `8195046d`
Rendering the real customer widget (`/widget/care/[embedToken]`) showed ELOSTATE's global Feedback
button + Jeff chat FAB rendering ON the embed. `/widget/layout.tsx` intends a clean shell but can't
escape the root layout, and the FABs' hide-lists covered `/dashboard` + landing but NOT `/widget`.
On a customer's own site that means a DUPLICATE chat bubble over the support widget + a "Feedback"
button routing to ELOSTATE's `/login` (internal chrome leaking to a prospect's end-users). Fix:
exclude `/widget` in both (`WIDGET_HIDDEN_PREFIXES` += "/widget"; `pathname.startsWith("/widget")`
guard in FeedbackButton). Verified by CDP: 0 FABs on the widget URL. **This is the highest-severity
find of the cycle — it's on the actual product customers embed.** The under-audited surface paid off.

Note: the widget's own "Couldn't load the widget" state in my local render is EXPECTED (the tenant's
`allowed_origins` is `[]` and I loaded from localhost in production mode → origin correctly rejected),
not a bug. The widget's internal chat UI couldn't be fully rendered locally without mutating a live
tenant's `allowed_origins` (declined — real data). Deferred as a code-level review target.

---

### V6 — Conflicting robots meta on the customer widget (LOW-MED, structural/SEO) — FIXED `2377ecc0`
`/widget/care/[embedToken]` emitted TWO robots directives in one head: `noindex,nofollow` (widget
layout's hand-rolled `<meta>`) + `index, follow` (root metadata). A nested layout can't own a real
`<head>`, so the manual tag couldn't override the root. Google takes the most-restrictive (noindex
likely wins) but it's fragile — other crawlers could index tenant embed-token URLs. Fix: replace the
manual meta with a Next.js `metadata` export (`robots: {index:false, follow:false}`) which properly
overrides the parent for `/widget/*`. Verified: single `noindex, nofollow` on the widget; home still
`index, follow`. Found while auditing the root layout for the V5 class (§1.2 — same surface, sibling bug).

---

## Open — founder decision

### A3 — Global `userScalable: false` disables pinch-zoom on ALL pages (MED, a11y) — DECISION
`src/app/layout.tsx` viewport sets `maximumScale: 1` + `userScalable: false` for the whole app,
including PUBLIC marketing/login pages. The intent is PWA feel + no iOS input auto-zoom. But Android
Chrome HONORS `userScalable:false`, so Android users cannot zoom any ELOSTATE page — a WCAG 1.4.4
(Resize Text) failure on the public surfaces prospects land on. (Modern iOS Safari ignores it for a11y;
Android does not.) Options: (a) drop `userScalable:false`/`maximumScale` app-wide and keep the 16px
input sizing that already prevents iOS auto-zoom (recommended — a11y-correct, input-zoom already
handled); (b) keep the lock only inside the installed PWA (standalone display-mode) via a runtime
check; (c) accept the tradeoff. Not changed unilaterally — the current value was a deliberate choice.

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
