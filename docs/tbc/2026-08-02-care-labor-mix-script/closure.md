# CLOSURE — C.A.R.E AI-labor-mix read-only script

## What shipped
`scripts/care-labor-mix.mjs` (+ `npm run care:labor-mix`) — a read-only live-DB tool that partitions resolved
C.A.R.E conversations into the three human-labor tiers (fully-deflected / co-pilot-assisted / fully-manual) that
size the VA team for the "Managed C.A.R.E / save-15%" offer. Verified live (N=6 baseline; the honesty guard
correctly flags it as directional-only).

## Un-named reliance (not self-evident)
- **It decides nothing.** The tool reports a measured mix; the VA-team sizing and the price stay the founder's
  call (§3.3). It exists so the number is *measured*, not guessed.
- **The number is NOT usable yet.** N=6 → the split is noise; the script says so itself and I did not price off
  it. It becomes meaningful only at real C.A.R.E volume — that's a data condition, not a code TODO.
- **The tiers are exhaustive and by "highest human touch":** a conversation with ANY unaided agent message is
  `fully_manual` even if it also had co-pilot replies — the conservative choice (a human still spent full effort
  on that reply). Internal notes count as an agent touch (a human worked the ticket). Change this definition
  only with intent — it's the labor semantics the VA sizing depends on.
- **Read-only, live.** Uses the same Session-pooler `SUPABASE_DB_URL` + `pg` pattern as `verify:live`; runs one
  SELECT. No unit test (a live-DB script, like `verify:live`, is verified by running it — check.md).
- **It confirms the founder-PDF query.** The same derivation is quoted in ELOSTATE-PRICING-ANALYSIS-Phase1-2;
  running this proved that query is correct against the real schema.

## Flagged, not fixed (§3.3)
- none. The metric feeds a founder pricing decision that stays open (the VA-cost blocker is unrelated to this tool).

## Residual (A36)
```json
[
  { "id": "RES-01", "item": "No unit test — the pure part (SQL partition) is exercised only via the live run.", "why_skipped": "It's a live-DB analytics script; the repo precedent (verify-invariants-live.mjs) has no unit test either, and the live run against the real schema is stronger evidence than a mock. The SQL is the logic; mocking pg would test the mock.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-02T04:18:30Z", "outcome": "OPENED — verified by live execution (check.md), partition sums to N." },
  { "id": "RES-02", "item": "Metric is not surfaced in any UI/readout — only the CLI script.", "why_skipped": "A UI surface is a founder-gated feature; the CLI tool is the non-overtaking, dead-code-free way to make the number available now.", "confidence_it_does_not_matter": "medium", "opened_at": null, "outcome": null }
]
```
