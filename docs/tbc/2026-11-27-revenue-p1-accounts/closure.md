# CLOSURE - Revenue Phase 1: accounts and contacts

## What is true now

A deal has an account, found or made by one company-wide key, and contacts with roles. A call has the people who were
on it. Accounts has a list (mine / team) and a page per account with its deals, contacts and one timeline. Erasure
reaches contacts and accounts through the same request: shown, confirmed, renamed; contacts on erased calls renamed with
the calls. Visibility is tighter than Gong's: whoever made the account or can see a deal on it.

Un-named reliance: prospects' RLS (0303/0304) decides who sees an account through its deals; a deal moved off an
account still lets its rep see that account (the 'account' event history is the test), recorded below.

## Residual

```json
[
  {"id": "R1-old-account-visibility", "item": "A rep whose deal moved off an account keeps seeing that account.", "why_skipped": "Visibility follows any 'account' event of a deal the caller can see; restricting to the latest would put a per-deal subquery in every account policy check.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T20:29:25Z", "outcome": "Recorded."},
  {"id": "R2-account-merge", "item": "Two accounts for one company (e.g. 'Acme' and 'Acme Inc') can't be merged yet.", "why_skipped": "Merge is its own step in the plan (suggestions by looseKey); a rename to a used name is refused (409) instead of merging by accident.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-26T20:29:25Z", "outcome": "Recorded."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
