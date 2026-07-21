# C.A.R.E demo page — ship & handoff guide

**Branch:** `feat/care-demo-page` (HEAD `bd060d62`, off `main`, pushed)
**Route:** `elostate.com/demo/c.a.r.e` (public, static prerender)
**Migration:** none — additive only, zero touch to existing code.

A **live, in-product** C.A.R.E sales demo a salesperson drives in front of a prospect.
Distinct from the PDF leave-behind (`docs/CARE-demo-sheet.*`, a different branch).

---

## What's on the branch

| File | What it is |
|------|-----------|
| `src/app/demo/c.a.r.e/page.tsx` | The page. Client component, static prerender, public. Hero → best-feature → walkthrough → malleability → compare table → honest note → CTA. |
| `src/components/care/demo/CareDemoWalkthrough.tsx` | Ask 3 — the click-by-click: 7-step stepper, customer widget (left) + agent inbox (right) advancing together, caption + "why it matters" per step, arrow-key nav, 4-tool legend. Self-contained (no backend) → demo-proof. |
| `src/components/care/demo/CareDemoMalleability.tsx` | Ask 2 — live General⇄E-commerce toggle reshaping the capture card + the real per-tenant config knobs. |

The four agent tools shown are the **real** ones: **Coach · Co-Pilot · Summarize · Formulate**
(NOT "Dissect" — that's a separate ELOSTATE feature).

---

## Before sending to prospects — 1 required edit

**`BOOKING_URL`** in `src/app/demo/c.a.r.e/page.tsx` (near the top) is a `/login` placeholder.
Replace it with your real booking / contact link. It drives the header "Book a demo", the
closing CTA, and nothing else.

```ts
const BOOKING_URL = "/login"; // → replace with your booking link
```

---

## Deploy sequencing (honesty — read this)

The page is **safe to deploy alone** (it imports no handover code; it's a scripted mock).
BUT two claims it makes go fully live only with the handover feature:

- the **structured capture** at handoff (name / email / concern / order #), and
- the **handoff sentinel** ("detected reliably…").

Both live on **`feat/care-handover-capture`** + migration **`0188`**. The four agent tools are
already live on `main`.

**→ Deploy this page together with `feat/care-handover-capture` (and apply `0188`)** so the demo
never oversells. If you must ship the page first, know that those two lines describe near-term,
not-yet-live behavior until the handover branch deploys.

(Whole-product deploy is itself the standing bottleneck — Vercel auto-deploy has been off; see
the deploy notes in the handover guide / memory.)

---

## Verify locally (optional, before deploy)

`npm run start` won't serve this app (`output: standalone`). Use the standalone server:

```bash
npm run build
cp -r .next/static  .next/standalone/.next/static
cp -r public        .next/standalone/public
PORT=4321 node .next/standalone/server.js
# → http://localhost:4321/demo/c.a.r.e
```

Headless screenshot to eyeball it (Edge):

```bash
"/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" \
  --headless=new --disable-gpu --hide-scrollbars --window-size=1200,4400 \
  --screenshot="shot.png" "http://localhost:4321/demo/c.a.r.e"
```

---

## Verification already done (this session)

- tsc + eslint + `next build` green; `/demo/c.a.r.e` prerenders static.
- Desktop render screenshot-verified; fixed a light-mode dark-on-dark contrast bug in the
  interactive panels (now a deliberate fixed-dark "product-screen" look).
- Mobile verified — content stacks correctly (the right-edge clip in headless shots is a
  screenshot artifact; the production landing page clips identically at that setting).
- A11y — interactive controls get the global focus-visible ring; the walkthrough group has its
  own ring + arrow-key nav.
- Fact-integrity — every product claim traced to the codebase; the two deploy-gated claims are
  the only forward-looking ones, flagged above.

**Not done:** end-to-end runtime confirmation on a real device — that's the founder's call.

---

## Open founder choices (built on defaults; adjust any)

1. **Walkthrough pacing** — click/arrow-to-advance (auto-play not built).
2. **Page shape** — single page with anchored sections.
3. **Real Jeff vs mock** — kept the real global Jeff widget live + a distinct dark walkthrough console.
4. **CTA** — `BOOKING_URL` placeholder (see above).
