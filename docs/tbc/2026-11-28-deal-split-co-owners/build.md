# BUILD - Deal splits: co-owners and review fixes

### Split check
write-path: rss_check_deal_split (0395) refuses a signed-in caller's row for another company first, and a removed member.
read-path: none.

### Co-owner access
write-path: none — every write still goes through the deal's own RLS, which doesn't know co-owners.
read-path: rss_co_owned_deals / rss_is_co_owner (service role); GET /api/coach/remote/prospects returns coOwned on your own pipeline; GET /api/coach/remote/prospects/[pid] opens a co-owned deal read only (company-pinned, hidden calls left out, no suggestions).

### Forecast
write-path: a submission's snapshot holds the caller's share of each own and co-owned deal.
read-path: your board counts your co-owned deals' share; a team view's rows are its reps, with "credited by deal splits to people not on this board" said.
