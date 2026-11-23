# REMEDIATE - The rep's own weekly coaching routine

### F1 - "answered" had one rule in the manager inbox; the rep view needed the answer time too
isRequestOpen refactored onto a private answers() test; requestAnsweredAt uses the same one. The route consumes both.
gate-or-promise: gate (feedback.test.ts requestAnsweredAt case asserts both functions agree)
