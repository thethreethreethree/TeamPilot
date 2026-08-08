# CLOSURE — connect handoff id-source guard

## What shipped
One assertion completing the connect-handoff parameterization coverage: the sales branch must pin to
`NEXT_PUBLIC_SALES_EXTENSION_ID` (regex-locked ordering), so a crossed ternary that misdirects the session +
refresh token to the wrong extension fails CI. Test-only; the shared connect page is not modified. Message-type
half was already guarded; this adds the id-source half.

## Un-named-reliance check
Source-substring guard (reads `page.tsx`, matches a regex). It relies on the page keeping the pinning as an
inline `sales ? SALES : CARE` ternary. If a refactor moved the selection into a helper function, the regex
would false-NEGATIVE (fail on correct code). That reliance is named: it is acceptable because such a refactor
is exactly the moment to re-examine this guard (and it would fail loudly in CI, prompting the update, not
silently pass a wrong pinning). The guard fails safe (toward noise), not toward a missed misdirection.

## Residuals
```json
[
  {
    "id": "R1-source-regex-not-runtime",
    "item": "The guard checks page SOURCE text, not runtime behavior — it can't prove the branch executes correctly in a browser (the page is a client component, unrenderable in the node test env).",
    "why_skipped": "Component/DOM rendering isn't available in this vitest-node setup; the predicate itself (isExtensionHandoffAllowed) IS runtime-tested in extensionHandoff.test.ts. The realistic regression here is a source-level ternary swap, which the regex catches.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-08T03:44:00Z",
    "outcome": "OPENED and resolved: the two layers are covered separately — the predicate's runtime behavior by extensionHandoff.test.ts, the page's id-source selection by this source guard. The gap between them (page imports the right predicate but wires the wrong env) is exactly what a browser E2E would cover and is on the founder's live-confirm runbook. String-level is the right weight for the ternary-swap regression; runtime rendering here would be gold-plating (A24). No action."
  }
]
```
