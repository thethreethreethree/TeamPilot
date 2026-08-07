# Sales Coach Extension — build status & decisions

*Last updated 2026-08-08. Founder-facing summary of the Sales Coach browser-extension build. For the
developer-facing port instructions see [`extension-sales/README.md`](../extension-sales/README.md).*

---

> **Status (2026-08-08): functionally complete end-to-end.** Download → install → Sign in → run the 5 tools
> is all built, CI-green, and deployed. Two founder calls remain before a **public** launch: a real Sales
> Coach **icon** (the toolbar icon is a C.A.R.E placeholder today) and the **entitlement-source** decision
> (share the C.A.R.E plan vs a separate sales SKU). Neither blocks you testing it yourself now.

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
- **Client package skeleton** (`extension-sales/`) — the extension's manifest and its tool list, wired to the
  five routes above, with a drift guard that fails the build if a tool ever points at a missing route (or a
  route is built but never surfaced).

---

## Two decisions I need from you

### 1. Entitlement — does Sales Coach share the C.A.R.E extension plan, or get its own?

Right now the sales tools gate on the **same** entitlement as the C.A.R.E extension. Whether that's correct is
a **pricing decision, not an engineering one**, so I didn't guess it:

- **Share it** — one "extension access" covers both C.A.R.E and Sales Coach. Simplest for customers; nothing
  more to build.
- **Separate** — Sales Coach is its own SKU / trial (its own price, its own 14-day trial).

**My recommendation:** decide this alongside the overall pricing/module structure (it's part of that same
work). The plumbing is ready either way — I already made the "trial ended" message name the correct product,
so whichever you choose is a small wiring change, not a rebuild.

### 2. Go-ahead for Phase 2 (the browser client)

The **server** is done. The **browser client** (the actual installable extension the rep clicks) is the
remaining half. It **cannot be tested in this build environment** (there's no browser here), so it ships
"reasoned + confirmed live by you per platform" — exactly how the existing C.A.R.E extension's per-site
readers work. It's a well-scoped, mostly-mechanical port from the C.A.R.E extension; the full spec is in
[`extension-sales/README.md`](../extension-sales/README.md). It needs, roughly:

1. The on-page panel that shows the five tools and their results.
2. The per-site readers that pull the open conversation from each platform's page.
3. The "Sign in" handoff that gives the extension its first token.
4. Icons + a store listing.

The handoff (#3) depends on decision **#1** (which entitlement the sign-in grants).

---

## Honest boundaries

- **Nothing here is a shipped end-user feature yet** — no rep can click a tool until the Phase 2 client is
  built. The server side is verified *substrate*; every build record says so plainly rather than dressing it
  up.
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
