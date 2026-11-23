# BUILD - Erasure: say the short-name limit; take the bracket

Migration 0324 (rss_erasure_text_pattern) — applied to production.

### Search by client name
write-path: none.
read-path: Settings → Protection → erasure → "Find by: Client name" → a hint: calls match exactly; day plans and the
pipeline match any mention, so a shorter form needs its own search.

### Erase a phone number from a plan or prospect
write-path: rss_erase_day_plans / rss_erase_prospects → rss_erasure_text_pattern (0324: optional "(" before the digits)
→ the whole written number becomes "[removed]".
read-path: the rep's plan shows "[removed]" with no stray bracket.
