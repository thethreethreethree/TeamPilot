# REMEDIATE - Follow a saved search and see its new calls

### F1 - a background matcher would bypass access
gate-or-promise: promise (design; route test asserts the caller's client is used via newMatches)
### F2 - a failed run would show as "nothing new"
gate-or-promise: gate (route test "a failed run is null, never 0")
### F3 - the search's own from-date could be ignored
gate-or-promise: gate (savedSearchFollow test)
### F4 - an old follow could fall off a capped read
gate-or-promise: gate (invariant audit: .limit(N>1000) is refused)
