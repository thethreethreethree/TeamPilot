# REMEDIATE - Smart trackers: the same idea in any words

### F1 - smart hits had no time, so their chips couldn't jump to the moment
Computed exactly as trackerScan does (audioBaseIso + spoken_at) and carried forward on corrections.
gate-or-promise: gate (smartTrackerScan.test.ts pins at_ms 65000 for a line 65 s in, and its carry)

### F2 - a backfill would re-read every smart tracker on each call
onlyTrackerId narrows the read to the new tracker.
gate-or-promise: gate (route.test.ts pins onlyTrackerId on every backfill call; smartTrackerScan.test.ts pins the id filter)

### F3 - a smart chip would quote the example as if the customer said it
The hit carries `smart`; the chip reads "like “example”".
gate-or-promise: promise (the chip wording; one line in TrackerHitChips)
