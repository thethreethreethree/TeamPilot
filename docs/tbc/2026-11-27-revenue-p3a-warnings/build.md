# BUILD - Revenue Phase 3a: Gong's deal warnings in dealRisk

Migration 0372 (rss_deal_signals, rss_valid_stage_list with stall_days). No env keys.

### A deal's warnings on the board
write-path: none new. The facts come from calls, transcripts, stage events and contacts already written.
read-path: listProspects → rss_deal_signals (caller's client) + the stage list's stall_days → dealRisk → Board / List / Forecast.

### A manager sets a stage limit
write-path: Board → Stages → "stalls after N days" → POST /deal-stages {stall_days} → deal_stage_lists (CHECK allows 1–365, whole days).
read-path: listProspects → stallDays → dealRisk "stalled".
