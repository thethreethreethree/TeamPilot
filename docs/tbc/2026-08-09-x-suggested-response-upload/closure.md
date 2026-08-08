# CLOSURE

## What shipped
Two founder-picked features on the Sales Coach extension: (1) **Suggested Response** — the three reply buttons
merged into one action with an optional guidance box, dispatching to the existing co-pilot/formulate engines;
(2) **Upload conversation** — a PDF/DOCX/TXT upload that the server extracts to text (reusing
`documents/extractText`) so every tool can run on a pasted-then-exported chat. Plus a backward-compatible
`guardExtensionRequest` overload so the multipart route reuses the one canonical gate. The full gate passed
at exit 0 (2560 tests) — the pasted command output is in check.md.

## Un-named reliance (A35) — clauses this build leaned on but didn't headline
- **INV24 / injection-fence posture** (`reference_llm_injection_fence_posture`): /suggest does NOT add its own
  fence — it inherits it because it reuses `generateSalesCopilotReply`/`generateSalesFormulate`, which fence the
  transcript. Verified this is why INV24 stays green (the engines fence; the route delegates). If a future
  suggest variant inlined a prompt, it would need the fence.
- **CWE-209 (raw-error leak)**: applied in /extract — a parser exception logs server-side and returns a generic
  message, never the raw stack. Same discipline as the sibling route.
- **Vercel serverless body limit**: the 4 MB cap is not arbitrary — it's under Vercel's ~4.5 MB function-body
  limit (multipart passes through the function), the same reason the sibling caps there.

## Residuals
```json
[
  {
    "id": "R1-client-runtime-unverified",
    "item": "content.js (upload UI, optional-input Run, suggested render) and background.js (base64→multipart→extract round-trip, guidance forward) are RUNTIME-UNVERIFIED — no browser/Chrome APIs in the build sandbox. Locked by source-wiring tests, not executed live.",
    "why_skipped": "The extension client can't run here; this is the established, documented posture for both the sales and C.A.R.E extensions.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-09T10:50:00Z",
    "outcome": "OPENED — founder live-confirm needed: (a) Suggested Response with and without guidance, (b) upload a PDF and a TXT and confirm the text is captured + a tool runs on it. The base64 path (readAsDataURL → strip prefix → worker atob → File) is the one genuinely new mechanism; everything else mirrors working patterns."
  },
  {
    "id": "R2-superseded-routes-retained",
    "item": "coach/copilot/formulate ROUTES are no longer client buttons but were RETAINED (documented in NON_TOOL_ROUTES) rather than deleted; /suggest reuses their engines directly.",
    "why_skipped": "Deleting live, tested prod routes under an autonomous build is the more dangerous direction; keeping them is harmless (gated, unreferenced) and reversible.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-09T10:51:00Z",
    "outcome": "OPENED — founder cleanup decision: delete the three superseded routes (and the now-unused salesReplyCoach engine + test) in a follow-up, or keep them. No behavior depends on the answer."
  },
  {
    "id": "R3-extract-accepts-format-superset",
    "item": "The founder said PDF + TXT; extractText (and thus /extract) also accepts docx/odt/epub/html/rtf/md. The panel's file picker `accept` is limited to .pdf/.txt/.docx/.md, but the server accepts the full extractText set.",
    "why_skipped": "The superset is free (the shared util handles them) and strictly document types — no new risk; narrowing would be extra code for no benefit.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-09T10:52:00Z",
    "outcome": "OPENED, informational — tell me if you want the server to hard-restrict to pdf/txt only."
  }
]
```

## Not done / flagged
- The C.A.R.E extension package rebuild + this extension's zip rebuild are separate deploy steps (the served
  `public/sales-coach-extension.zip` is built by `scripts/build-sales-extension-download.mjs`) — NOT run here.
  The source is complete; the shipped zip needs a rebuild before the founder tests the downloaded extension.
