# REMEDIATE - Tracker start and end dates

### F1 - a dated tracker would still cost an AI call on calls outside its dates
gate-or-promise: promise (filter order in smartTrackerScan)
### F2 - "end date" could exclude its own last day
gate-or-promise: gate (trackerAppliesTo boundary test; route range test)
