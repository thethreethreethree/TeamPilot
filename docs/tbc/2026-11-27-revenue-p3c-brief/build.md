# BUILD - Revenue Phase 3c: the deal brief and suggested next steps

Migration 0374 (deal_briefs; rss_erase_sessions and rss_erase_prospects extended). No env keys; engine rss_deal_brief.

### A rep writes a deal brief
write-path: deal panel → Write a brief → POST /prospects/:id/brief → loadDealCalls (caller's client) → dealBriefCoach → parseDealBrief → deal_briefs row (service role, once per basis).
read-path: GET /prospects/:id/brief → the latest brief and whether its basis is stale → the Brief section.

### A next step becomes a to-do
write-path: Brief → Add as to-do → POST /prospects/:id {action:"todo"} → a Task on the deal's rep, linked to the deal.
read-path: the deal's To do; Tasks.

### Erasure
write-path: rss_erase_sessions / rss_erase_prospects → delete the erased deals' briefs.
read-path: the deal shows no brief.
