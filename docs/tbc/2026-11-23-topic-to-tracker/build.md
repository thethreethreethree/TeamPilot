# BUILD - Turn a Market topic into a tracker

No migration. No env keys.

### Track a topic
write-path: Remote Sales → Market → a topic → "Track" → POST /api/coach/remote/trackers { name, phrases: [name, …wordings],
side: "customer" } → requireSalesCoachManager → insert keyword_trackers → POST { action: "scan" } (latest calls).
read-path: "Tracking ✓" → Remote Sales → Trackers lists it with its hits; adoption views include it.
