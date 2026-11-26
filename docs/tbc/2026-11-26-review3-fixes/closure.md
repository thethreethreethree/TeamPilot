# CLOSURE - Acting on the third review

## What is true now

A manager can delete or save a rep's recording only if the rep is in their reporting tree and the call is not hidden
from them; otherwise the call is "not found", as another company's would be. Invariant 43 checks every call table the
hide rules cover. Erasure scrubs a callback's signals wherever they were filed. A call with no recording lists its
questions as text, saying why they can't be played.

Un-named reliance: the guard relies on rss_tree_allows and rss_call_hidden_for remaining the policies' own functions
(hideCoverage and treeAccess tests pin that).

## Residual

```json
[
  {"id": "R1-score-events", "item": "pitch:<id> events (dispute and answer notes on a score) are not erased by rss_erase_sessions.", "why_skipped": "0285 excluded notes a person retyped; whether these count as the customer's data is the founder's decision.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T00:10:00Z", "outcome": "Asked as a picker."},
  {"id": "R2-like-underscore", "item": "0348/0349 match subjects with LIKE 'sales_session:%', where _ matches any character.", "why_skipped": "No subject in the codebase collides; changing it means rewriting a production policy and trigger for no present effect.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-26T00:10:00Z", "outcome": "Accepted."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
