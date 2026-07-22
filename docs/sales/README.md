# C.A.R.E Extension — Sales Collateral

Ready-to-use assets for selling the C.A.R.E browser extension. Each PDF is rendered from the `.html` source
beside it — edit the HTML and re-render (headless Edge `--print-to-pdf`) to update copy, numbers, or branding.

| Asset | Audience | Use it when… |
|---|---|---|
| **`care-extension-sales-pitch.pdf`** | **Prospects** (external) | You want to *show* the product — a 2-page leave-behind / email attachment. Leads with the promise, the 6 tools, a real before→after Co-Pilot example, and a "get the extension" CTA. Every claim is fact-checked against the product. |
| **`care-extension-pricing-sales-guide.pdf`** | **Your sales team** (internal) | Prep before a pricing conversation. The recommended $24/seat, the ROI math, the competitive table, and objection-handling scripts. Not for the customer — it shows *our* cost floor + capture rate. |

## Before you send anything

- **Pricing is a recommendation** ($24/agent/mo, free 14-day trial, bundled with full C.A.R.E). Confirm the final
  list price before it goes in a contract. The pricing guide carries an "estimates — confirm before contract"
  disclaimer for exactly this reason.
- **The extension isn't sellable yet** until two builds ship (both flagged at the top of
  [`../FOUNDER-ACTION-QUEUE.md`](../FOUNDER-ACTION-QUEUE.md)): the **entitlement write-path** (today the extension
  is `locked` for every tenant — no trial or paid unlock actually fires) and, for per-agent billing, the **seat
  model**. The *story* is ready; the *infrastructure to charge and unlock* is the pending build.

## Regenerating a PDF

```bash
# from the repo root, with the .html edited:
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
"$EDGE" --headless=new --disable-gpu --print-to-pdf-no-header \
  "--print-to-pdf=docs/sales/<name>.pdf" "file://$(pwd)/docs/sales/<name>.html"
```
