# Chrome Web Store — Privacy tab documents

Everything the **Privacy practices** tab of the Chrome Web Store Developer Dashboard asks for, generated per
[`docs/sales-coach/chrome-web-store-privacy-tab-reference.md`](../sales-coach/chrome-web-store-privacy-tab-reference.md).
One folder per extension. Submit **Sales Coach first** (lean, least-privilege → faster review), then C.A.R.E.

## Where each doc goes in the dashboard

| Dashboard field (Privacy practices tab) | Document |
|---|---|
| **Single purpose** | `single-purpose-statement.md` |
| **Permission justification** (one box per permission) | `permissions-justifications.md` |
| **Are you using remote code?** | `remote-code-declaration.md` |
| **Data usage** — category checkboxes + Limited-Use certification | `data-usage-disclosure.md` |
| **Privacy policy URL** (Store listing tab) | `privacy-policy.md` → hosted at the URL in that file |

## Folders

- [`sales-coach/`](./sales-coach/) — Sales Coach extension (permissions: `activeTab`, `scripting`, `storage`,
  host `elostate.com`; no media, no broad host). Privacy policy hosted at
  `https://elostate.com/extension/privacy-sales`.
- [`care/`](./care/) — C.A.R.E extension (adds a Supabase host + an **optional** `*://*/*` for the opt-in
  Capture-media feature). Privacy policy hosted at `https://elostate.com/extension/privacy`.

## Accuracy notes (read before you certify)
- **The conversation text IS sent to a third-party AI sub-processor (DeepSeek)** to generate results. Every doc
  discloses this. Do **not** certify "no data transferred to third parties" — disclose the sub-processor instead.
  The live privacy pages were corrected on 2026-08-09 to match (a drift-guard test enforces it).
- **Do not add any claim that DeepSeek itself does not retain the text** unless your DeepSeek DPA supports it —
  the wording here deliberately only claims what's verifiable (our backend doesn't retain it; we don't sell/train
  on it). This is the one thing that still needs your legal sign-off.
- These are the paste-ready **Privacy tab** contents. The broader submission packages (build command, store
  listing copy, screenshots checklist) live in each extension's `CHROME-WEB-STORE-SUBMISSION.md` and in
  [`docs/CHROME-WEB-STORE-READINESS.md`](../CHROME-WEB-STORE-READINESS.md).
