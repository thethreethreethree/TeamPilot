# Sales Coach Extension — build status & decisions

*Last updated 2026-08-08. Founder-facing summary of the Sales Coach browser-extension build. For the
developer-facing port instructions see [`extension-sales/README.md`](../extension-sales/README.md).*

---

> **Status (2026-08-08): functionally complete end-to-end, incl. the browser client.** Download → install →
> Sign in → run the 5 tools across **13 web platforms** is all built, CI-green, and deployed — the server, the
> on-page panel, the per-site readers, the connect handoff, the download page, and a founder test runbook
> ([`SALES-COACH-EXTENSION-TESTING.md`](SALES-COACH-EXTENSION-TESTING.md)). Three founder calls remain before a
> **public** launch (none block you testing it yourself now): a real Sales Coach **icon** (toolbar icon is a
> C.A.R.E placeholder today), the **entitlement-source** decision (share the C.A.R.E plan vs a separate sales
> SKU), and the **error-detail policy** (see decision 3). Prod also needs `NEXT_PUBLIC_SALES_EXTENSION_ID` set.

## What it is

A **standalone Chrome extension** (your architecture decision, 2026-08-08) that puts sales coaching on the
conversation a rep is **already viewing** — Gmail, Outlook, Instagram, Messenger, WhatsApp Web, LinkedIn,
Slack, and the other web platforms the C.A.R.E extension already reads. Same idea as the C.A.R.E extension,
focused on sales. It reads the open thread from the page, sends the **text** to our server, and shows the
coaching back in an on-page panel.

---

## What is built and verified (the whole server side)

Everything below is live on `main`, passes the full gate (`npm run check`, 2469 tests), and is documented with
its own build record under `docs/tbc/`.

**Five coaching tools** — each is text-in (the rep's viewed conversation), grounded in the sales methodology
(SPIN / Challenger / Voss / Navigate 2.0), and never fabricates:

| Tool (panel label) | What it does | Route |
| --- | --- | --- |
| **Read the room** | What's working + the opportunity + the next move | `/api/coach/extension/dissect` |
| **Coach my reply** | Grades the rep's *draft* against the sales books | `/api/coach/extension/coach` |
| **Catch me up** | Where the deal stands (state / objection / next step) | `/api/coach/extension/summarize` |
| **Draft my reply** | Drafts the next message + names the sales move used | `/api/coach/extension/copilot` |
| **Say it for me** | Shapes what the rep *wants to say* into a strong message | `/api/coach/extension/formulate` |

*(This matches the C.A.R.E toolset except "spawn a task", which writes to the internal team chain and doesn't
fit an external-conversation tool.)*

**Supporting infrastructure, all built and tested:**

- **Session refresh** (`/api/coach/extension/refresh`) so a rep isn't logged out every hour.
- **Auth + rate limiting** — reused from the C.A.R.E extension (the same server gate; never trust the client).
- **Prompt-injection defense** on every tool (a prospect line that reads as a command is treated as data,
  never obeyed) — and a build-time guard (INVARIANT 24) that fails the build if a future tool forgets it.
- **Complete browser client** (`extension-sales/`) — MV3 service worker + on-page shadow-DOM panel + 13
  per-site readers (7 Tier-1 reused from C.A.R.E, 6 Tier-2 new), the product-aware Sign-in handoff, the
  download page, and a drift guard that fails the build if a tool points at a missing route. Adapter routing +
  the extraction contract (incl. the §3.4 never-fabricate → manual-fallback) are locked by tests.

---

## Three decisions I need from you

### 1. Entitlement — does Sales Coach share the C.A.R.E extension plan, or get its own?

Right now the sales tools gate on the **same** entitlement as the C.A.R.E extension. Whether that's correct is
a **pricing decision, not an engineering one**, so I didn't guess it:

- **Share it** — one "extension access" covers both C.A.R.E and Sales Coach. Simplest for customers; nothing
  more to build.
- **Separate** — Sales Coach is its own SKU / trial (its own price, its own 14-day trial).

**My recommendation:** decide this alongside the overall pricing/module structure (it's part of that same
work). The plumbing is ready either way — I already made the "trial ended" message name the correct product,
so whichever you choose is a small wiring change, not a rebuild.

### 2. A real Sales Coach icon

The toolbar icon today is the **C.A.R.E placeholder**. It works, but it should be its own mark before a public
listing. This is a design asset, not an engineering task — give me the icon (or the go-ahead to commission
one) and I'll wire the 16/48/128px set into `extension-sales/icons/` and rebuild the download.

### 3. Error-detail policy (a codebase-wide call, surfaced honestly)

When an AI call fails, the extension currently returns the provider's error cause — including the AI vendor's
name and up to 200 chars of the upstream error body — to the signed-in rep. That is a **deliberate, existing
convention** across ~25 authed AI routes (a 2026-07-25 decision; classified intentional by the completed sweep
`docs/audits/2026-07-31-cwe209-error-leak-sweep.md`), so the sales extension follows it rather than diverging.

The open question is whether surfacing the **raw upstream body** (which can name the vendor) to a *customer's*
rep is still what you want, now that the product markets "C.A.R.E AI / ELOSTATE". If yes, the fix is small and
centralized at the **provider layer**, not 25 route edits: the raw body is interpolated into the error
*message* at 2 sites in `src/lib/llm/deepseek.ts` (lines ~153/235) and is *also* kept in a separate `rawBody`
field — so dropping it from the message at those 2 sites trims it from every route's response at once **while
keeping it in the server logs** (the Anthropic provider uses the SDK's own `e.message` and would need its own
quick review). It changes what every AI surface shows on an error, so it's your call, not a unilateral one. (I
attempted a broader version as a "fix" mid-build, then reverted it on realizing the surface is an intentional
convention — the honest path is to ask, with the accurate scope.)

---

**Phase 2 (the browser client) is DONE** — this was an open go-ahead in the prior version of this doc. The
on-page panel, the per-site readers (13 platforms), and the Sign-in handoff are all built and CI-green. What
remains is the icon (decision 2) and setting `NEXT_PUBLIC_SALES_EXTENSION_ID` in prod before a public listing.
The per-platform selectors ship "reasoned + confirm live per platform" (the same model as the C.A.R.E
extension) — the runbook [`SALES-COACH-EXTENSION-TESTING.md`](SALES-COACH-EXTENSION-TESTING.md) walks the
30-seconds-per-platform confirm loop.

---

## Store-launch readiness (brought up to parity this session)

A close comparison against the C.A.R.E extension found the port had silently dropped several launch-critical
things (a UI/extension port copies the happy path but drops the parent's accumulated guards and artifacts).
Fixed this session:

- **Privacy policy** — the sales extension had none (a Chrome Web Store listing *requires* one). Added
  [`/extension/privacy-sales`](../src/app/extension/privacy-sales/page.tsx), stating the sales extension's
  *actual* behavior (fully ephemeral — no "save", unlike C.A.R.E's Capture). **⚠️ It needs your legal review
  before it's the official policy** — it describes verified behavior, but the wording is yours.
- **Two unused permissions removed** — the manifest had inherited C.A.R.E's `*.supabase.co` host grant and its
  `*://*/*` optional-host grant (both exist only for C.A.R.E's image-capture flow, which sales doesn't have). An
  unused permission is the #1 store-rejection reason; the manifest now requests only what it uses.
- **Submission guide** — added [`extension-sales/CHROME-WEB-STORE-SUBMISSION.md`](../extension-sales/CHROME-WEB-STORE-SUBMISSION.md):
  paste-ready permission justifications, data disclosure, and a **draft** store description (yours to
  review/replace).
- **Download-page troubleshooting** + the privacy link were also dropped in the port; both restored.

**Net:** the extension is now store-*submittable* pending the three decisions above (icon, entitlement, error
policy) + your privacy-policy review + screenshots + the `NEXT_PUBLIC_SALES_EXTENSION_ID` pin.

---

## Honest boundaries

- **The client is built but not yet a *public* product** — you can sideload and use it today (per the test
  runbook), but a public store listing still needs the icon (decision 2) and the prod extension-id env var.
  The per-platform selectors are "reasoned + confirm live" until you verify each in a real browser; a miss
  fails safe to manual highlight, never a wrong reading.
- **"All top 20 platforms"** is bounded by what a browser can reach: iMessage/SMS/Signal have no web version
  an extension can read, and some apps are mobile-only. Realistic reach is ~15 web platforms (+4 reusable
  support desks); true mobile coverage would be a different integration (not an extension), a separate future
  decision. The full grounded breakdown — every platform, its hostname, whether it's reachable, and which
  reuse an existing C.A.R.E adapter — is in
  [`extension-sales/PLATFORM-COVERAGE.md`](../extension-sales/PLATFORM-COVERAGE.md).

---

## Build trail (for traceability)

Commits `d16c8947` → `01c91174` on `main` (2026-08-08): the five tools, the client core, session refresh, a
product-label honesty fix, three build-guard scope fixes + an injection-fence guard, two internal clean-ups
(shared rep-name + error-mapping helpers), the config↔route drift guards (both directions, for BOTH this
extension and the C.A.R.E one, plus a client↔server input-length sync guard), the platform coverage spec
([`../extension-sales/PLATFORM-COVERAGE.md`](../extension-sales/PLATFORM-COVERAGE.md)), and this status doc.
Each substantive build carries a `docs/tbc/2026-08-08-*` record with its reasoning, verification, and
residuals. All CI-green and deployed.
