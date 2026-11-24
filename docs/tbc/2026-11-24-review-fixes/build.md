# BUILD - Fixes from the review of the day's builds

No migration. No env keys.

### A manager marks Delivery items N/A on a no-objection pitch
write-path: dispute queue → "Doesn't apply" on the last real Delivery item → applyOverride → section_all_na (refused).
read-path: "That would leave nothing in this section that applies…"; Delivery keeps its score.

### A manager removes a comment that answered a request
write-path: comment Remove → revision (removed).
read-path: the request shows as open again in the inbox; the comment no longer counts in feedback or by-rep rows.

### Team call stats, Macro Today, by-rep requests
write-path: opening Today in Macro Mode → markTodaySeen() (this browser); nothing else is written.
read-path: times like 2:00 (never 1:60); Calls stays on Calls after Today was opened; a request about an old call shows
answered when it was.
