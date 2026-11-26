# BUILD - Revenue Phase 4: win/loss, deal drivers, account activity

Migration 0375 (rss_deal_signals + closed_at, rss_account_activity). No env keys.

### Win/loss by contacts, power and time to close
write-path: none new (contacts 0370, stage events 0303).
read-path: listProspects → contacts, signals (ranks), closedAt → winLoss byContactCount / byPower / byDuration → Sources.

### Deal drivers
write-path: none.
read-path: the pipeline in view → dealDrivers (dealRisk per deal) → Pipeline → Drivers (managers).

### Account activity
write-path: none (calls and transcripts).
read-path: listAccounts → rss_account_activity (caller's client) → activityScore / activityLevel → Accounts → Activity.
