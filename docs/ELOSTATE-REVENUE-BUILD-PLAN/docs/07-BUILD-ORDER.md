# 07 — Build order

Each phase is one TBC record. It's committed only after `npm run check` passes, its migration goes through `db:apply` and `verify:live`, then it's pushed (which deploys). Each phase ends in something you can open.

| Phase | Builds | You can look at |
|---|---|---|
| 1 | 0370 accounts, contacts, deal contacts, call contacts, backfill, erasure extension; routes; Accounts list and account page; account and contacts on the deal panel; "Who was this?" on the call | Accounts in Remote Sales, built from your existing pipeline |
| 2 | 0371 stages and saved views; Pipeline becomes the Deals board with filters, columns and roll-ups; panel tabs | The Deals board |
| 3 | 0372 warnings (nightly), playbooks, AI deal reviewer, suggested updates, deal brief | Warning chips, playbook letters, AI notes with cited lines |
| 4 | 0373 activity level; win/loss; deal drivers | Analytics (gated) |
| 5 | Ask Anything over a deal or an account | "Ask about this deal / account" |
| 6 | 0374 forecast boards, submissions, snapshots, accuracy | Forecast |
| 7 | Team revenue targets (F23.4; founder picker 2026-11-27) | The forecast board's team row with its target |
| 8 | A deal's field history (F23.11) and the forecast due day with an in-app reminder (F22.4); founder picker 2026-11-27 "Deal-flow batch" | The deal panel's Activity tab lists its field changes (stage, amount, close date, next call…); Forecast shows the due day and managers who haven't submitted get a bell reminder |
| 9 | Recommended contacts (F26.6): people on the deal's account heard on its calls who aren't on the deal | The deal panel's Contacts tab: "Heard on this account's calls", with "Add to deal" |
| 10 | Deal splits (F20.12; founder picker 2026-11-28 "Deal splits") | The deal panel's Overview: "Split" with each owner's share; the forecast board counts each person's share |
| 11+ | Engage, CRM / API / MCP, agents: their own plan | — |
