# BUILD - Deal splits

### Split storage
write-path: deal_splits (0394) through the caller's client from POST /api/coach/remote/prospects/[pid] {action: "split", shares}; checked by rss_check_deal_split; RLS: the rep or a manager the tree allows.
read-path: deal_splits_current (latest per deal) read by splitsFor through the caller's client.

### Forecast by share
write-path: none.
read-path: GET /api/coach/remote/prospects attaches each deal's split; metrics counts shareOf per person; the board's rows include co-owners (owners).

### Deal panel
write-path: the DealSplit editor posts the split.
read-path: GET /api/coach/remote/prospects/[pid] returns split and splitFailed; the Overview shows each owner's share.
