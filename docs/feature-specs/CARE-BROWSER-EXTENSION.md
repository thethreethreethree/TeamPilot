# C.A.R.E Browser Extension — Phase-Based Build Plan

> **Status:** SPEC / not started. This is the design artifact, not a build.
> **Requested:** founder, 2026-07-22.
> **Governance:** built through AMD-006's four-layer sieve (foundation-up: L1 structure → L2 effectivity →
> L3 composition → L4 UI/ship). §3.4 honesty throughout (esp. data governance). §3.3 guide-don't-overtake
> carries into the extension's tool behaviour (Ask Coach asks the user first). §3.6 make-learning-visible
> applies to how the extension surfaces value.

---

## 1. What this is

A **Manifest V3 browser extension** (Chrome + Edge first) that puts the six C.A.R.E tools —
**Formulate C.A.R.E · Ask Coach · AI Co-pilot · Spawn task · Summarize · Dissect** — on top of *any*
web conversation the user is already working in (email, helpdesk, CRM, chat). It is:

- **Login-gated** — the user authenticates to their own C.A.R.E tenant. Not anonymous.
- **Subscription-gated** — the server enforces plan entitlement on every tool call (client-side gating is
  UX only).
- **Tenant-grounded** — every tool runs against the user's own grounding (company brain, past resolutions,
  coach corpus). This is the moat an anonymous tool cannot have.
- **Two modes:** **(A) Universal selection-based** (works on every site, zero per-site code) and
  **(B) Per-site adapters** (auto-detect the thread on the top-10 platforms for a one-click experience).

### The key strategic fact
The AI engine already exists. The six tools have shipped server-side logic today:

| Tool | Existing reuse |
|---|---|
| Summarize | `POST /api/care/agent/conversations/[id]/summarize` |
| Co-Pilot | `.../co-pilot` |
| Formulate | `.../formulate` |
| Ask Coach | `.../ask-coach` |
| Dissect | `.../dissect/ask` |
| Spawn task | task-create flow in `ConversationsApp.tsx` |

So the extension is a **new front-end + a thin text-in endpoint layer on the existing engine**, not a new
product. The current endpoints are conversation-ID-scoped (bound to a Care inbox record); the extension
needs **text-in → result-out** endpoints (the shape of the already-built `/api/care/demo/ask`). That's the
main backend addition, and it reuses the same prompts (`buildCareSystemPrompt`, the dissect engine, coach
v5, the sales/care knowledge bases).

---

## 2. Structure, tooling & aesthetic (must match C.A.R.E)

- **Language/stack:** TypeScript + React, same as the app. Build with **Vite + CRXJS** (the MV3-native
  React/TS toolchain) — mirrors the app's Vite/vitest tooling so tests and lint rules carry over.
- **Design system:** the extension imports the **same design tokens** (`src/lib/design/tokens.ts` — the
  ember/ink scales) and the same Tailwind config subset, so the overlay is visually identical to the Care
  widget: theme-aware (light/dark via the same `data-theme` mechanism), `glass-card` surfaces, ember accent,
  the fixed-dark "console" treatment where appropriate. **No new palette.**
- **Component reuse:** the tool-result renderers (Coach card, Dissect layout, Co-Pilot draft) should share
  shape with the in-app versions so a user recognises C.A.R.E instantly. Where practical, extract the pure
  presentational pieces into a shared package both the app and the extension consume.
- **Monorepo placement:** `extension/` at repo root (or a workspace package), sharing tokens + types with
  the app. Its own `manifest.json`, content scripts, background service worker, and overlay UI.
- **Isolation:** the overlay renders in a **Shadow DOM** so host-site CSS can't leak into it and ours can't
  leak into the host — the standard robustness requirement for an inject-everywhere UI.

---

## 3. Founder decisions — RESOLVED 2026-07-22

- **D1 — Data governance: EPHEMERAL-BY-DEFAULT.** Scanned conversation text is sent to run a tool, then
  discarded; nothing persisted unless the user explicitly saves a resolution/task. GDPR-friendliest, honest,
  a selling point. Implemented as a backend policy (extension endpoints never write the raw scanned text to
  storage).
- **D2 — Entitlement: PRO plan OR an active limited free TRIAL; both require a logged-in account.** The
  extension is unlocked when the tenant is on `pro` (or `enterprise`) OR within an active trial window. The
  trial is time-boxed and account-gated (no anonymous use). Server-enforced on every call; the client only
  reflects locked/trial/active state. (Trial window + start need a small entitlement model — see Phase 0.)
- **D3 — Auth: `chrome.identity.launchWebAuthFlow` + PKCE → Supabase session token.** Open the app's login
  once; hand back a token the extension stores and sends on every API call. Chosen over cookie-reading
  (more robust across MV3).

---

## 4. Build phases (foundation-up per AMD-006)

### Phase 0 — Foundation & contracts *(L1 structure)*
The layer everything rests on. Nothing user-facing ships here.
1. **Extension scaffold:** Vite + CRXJS MV3 project; manifest (minimal permissions: `activeTab`, `scripting`,
   `identity`, `storage`; host permissions requested per-adapter, not broad); Shadow-DOM overlay shell.
2. **Shared design + types:** wire the extension to the app's design tokens + shared TypeScript types for the
   tool request/response contracts.
3. **Backend endpoint namespace `/api/care/extension/*`** — text-in → result-out for all six tools, each:
   `requireAuth` → `requireEntitlement(plan)` → `rateLimit` → reuse the existing prompt/engine → return the
   same result shape the in-app tool returns. (Summarize, Co-Pilot, Formulate, Ask-Coach, Dissect, Spawn-task.)
4. **Auth flow (D3)** + **entitlement middleware (D2)** — server is the source of truth; never trust the client.
5. **Data-governance switch (D1)** implemented as a backend policy, not a client toggle.
6. **Exit criteria:** a signed-in user can `curl`/call each extension endpoint with a raw text payload and get
   a correct, entitlement-gated result. (This is the L1/L2 boundary proof — the engine works headless before
   any UI.)

### Phase 1 — Universal selection-based MVP (mode A) *(L2 effectivity)*
The shippable "works everywhere" version.
1. **Content script:** capture the user's **selected text** (primary) or the visible thread as a fallback.
2. **Consent gate:** before capture, an explicit "Scan this conversation?" prompt (per D1, state that it's
   ephemeral). No silent scraping — this is a §3.4 trust surface, not a dark pattern.
3. **Overlay panel** (C.A.R.E aesthetic): the six tools; run the selected/captured text through the Phase-0
   endpoints; render results in the shared tool renderers.
4. **Auth + subscription live** — sign-in flow, locked state + upgrade prompt for non-entitled users.
5. **Exit criteria:** a subscribed user highlights a conversation on *any* site and successfully runs all six
   tools, grounded in their tenant. This is a real, sellable v1.

### Phase 2 — First deep adapters (mode B): Gmail + Gorgias *(L2 → L3)*
1. **Adapter framework:** a registry where each adapter exposes `matches(url)` → `detectThread()` →
   `extractConversation()` returning a normalized `{turns: {who, text, ts}[]}`. **Every adapter falls back to
   universal selection mode if the DOM shifts** — so a broken adapter degrades, never dead-ends (§1.5.1
   continuity, and the AMD-006 lesson that composition must not break the workflow).
2. **Gmail adapter** (#1 reach — e-comm *and* non-e-comm) — auto-detect the open thread.
3. **Gorgias adapter** (#4 — the e-comm wedge the founder named).
4. **One-click "Run C.A.R.E on this thread"** — no manual selection needed on these surfaces.
5. **Exit criteria:** one-click tool runs on a real Gmail thread and a real Gorgias ticket; both fall back to
   selection mode when the adapter can't find the thread.

### Phase 3 — Expand the top-10 adapters *(L3, pipeline-driven)*
Add the rest **in order of where paying customers actually work**, not by guess:
Zendesk (#3) · Outlook (#2) · then HubSpot / Front / Freshdesk / Shopify Inbox / Salesforce as the pipeline
dictates. Each is just a new adapter on the Phase-2 framework. Salesforce is last (heaviest DOM, highest
per-account value). **Explicitly out of the top 10:** Instagram/Facebook/WhatsApp — they fail the DOM-stability
and ToS tests; a separate, deliberate risk decision, not a core adapter.

### Phase 4 — Composition & the moat *(L3 synergetic composition)*
Make the tools cooperate and feed the tenant's compounding memory.
1. **Spawn task** → creates a real task in the user's C.A.R.E system, carrying the conversation context —
   so the extension isn't a dead-end island; it flows back into the product.
2. **Ask Coach** → the threaded, ask-you-first coaching dialogue (§3.3), not a one-shot answer.
3. **Save a resolution** (opt-in per D1) → feeds the tenant's institutional memory + patterns — the
   compounding advantage, made visible (§3.6).
4. **Deep tenant grounding** verified end-to-end (company brain, corpus, past resolutions in every result).

### Phase 5 — Polish, compliance & ship *(L4 UI/design + store)*
1. **UI/UX polish + accessibility** (both themes, keyboard, focus, reduced-motion) — matches C.A.R.E's bar.
2. **Privacy policy + consent copy + data-handling doc** (GDPR); the honest data story per D1.
3. **Chrome Web Store + Edge Add-ons submission** and review prep (MV3 permission justifications).
4. **Honest telemetry (§3.5/§3.6):** measure downstream consequence (were the coached replies better,
   resolutions durable), never "the suggestion was accepted."

---

## 4b. Chrome Web Store compliance (per chrome-web-store-publishing.md)

Baked into the build from Phase 0, not discovered at submission:
- **Minimal permissions.** Manifest requests only `activeTab`, `scripting`, `identity`, `storage`. Per-site
  host permissions (for adapters) are **`optional_permissions`** the user grants when enabling that adapter —
  never broad `<all_urls>` up front. Fewer permissions = faster review, fewer rejections.
- **Single-purpose statement:** "C.A.R.E — AI assistance for the conversation you're working on." One narrow
  purpose; do not describe it as a multi-tool grab-bag in the listing.
- **No remotely-hosted code / no `eval`/`new Function`** (MV3 CSP) — everything is bundled by Vite+CRXJS. API
  calls (data, not code) to the C.A.R.E backend are fine.
- **Privacy policy URL (required — we process conversation text).** Add a public `/extension/privacy` page in
  the app stating the D1 ephemeral policy: scanned text is processed to generate assistance and is NOT stored
  unless the user explicitly saves a resolution. Data-usage disclosure certified accordingly.
- **Distribution:** ship **Unlisted** first (direct-link beta), then Public once stable.
- **Version discipline:** semver; every upload bumps `version`.

## 5. Cross-cutting requirements (apply to every phase)

- **Security:** the server enforces auth + entitlement on every call; the client is never trusted (same
  discipline as the app's RLS/authz work).
- **Adapter resilience:** sites change their DOM; every adapter must degrade to universal selection mode, and
  adapter health should be monitorable so breakage is caught before customers report it.
- **Aesthetic parity:** no new design language — the extension IS C.A.R.E, elsewhere.
- **Reuse over rebuild:** every tool result reuses the existing prompt/engine; new code is the shell, the
  adapters, the text-in endpoints, and the auth/entitlement layer.

## 6. What is genuinely new vs reused

| New build | Reused |
|---|---|
| MV3 extension shell + Shadow-DOM overlay | Design tokens, theme system, tool-result renderers |
| Content scripts + adapter framework + 10 adapters | The six tools' prompts + engines |
| `/api/care/extension/*` text-in endpoints | Supabase auth, tenant resolution, plan tiers, rate-limit helper |
| Extension auth flow + entitlement middleware | Company brain / knowledge-base grounding |
| Consent + data-governance UX | Task-create, resolution/pattern chain |

---

## 7. Recommended sequencing (TL;DR)
**Phase 0 (contracts) → Phase 1 (universal, sellable v1) → Phase 2 (Gmail + Gorgias) → Phase 3 (Zendesk +
Outlook, then pipeline-driven) → Phase 4 (spawn-task + memory) → Phase 5 (polish + store).** Ship value at
Phase 1; every later phase adds reach or depth without blocking the previous one.
