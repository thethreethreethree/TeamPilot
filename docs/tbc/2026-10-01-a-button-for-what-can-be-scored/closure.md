# CLOSURE - a button for what can be scored

## What is true now

"Score them all" is offered only for recordings a press can score. Recordings with no rep speech are named in
one line and never get a button; when they are all that is left, the panel says everything that can be scored
has been, or does not appear.

## Residual

```json
[
  {
    "id": "R1-other-permanent-refusals",
    "item": "Only no_agent_turns is excluded from the count; the other permanent refusals (not_found, not_a_sales_call, suppressed) still count.",
    "why_skipped": "The candidate read already excludes non-sales sessions and unreadable ones; suppressed is an account state the drain names on its first press.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-10-01T13:50:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.

## Residual update (appended 2026-10-02T04:35Z)

- **R1-other-permanent-refusals: CLOSED, nothing to change.** Checked each: `not_a_sales_call` is
  `session.sessionKind !== "sales"` (scoreSession.ts:213), and the count's candidate read keeps only
  `.eq("session_kind", "sales")` (backfill/route.ts:128), so no such recording can be counted. `not_found` cannot
  arise for an id the same company-scoped read just returned. `suppressed` is the account, and the drain names it
  on the first press. The new `provider_down` (2026-10-02) is not permanent and is not excluded, correctly.
