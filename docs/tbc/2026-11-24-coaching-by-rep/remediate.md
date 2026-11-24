# REMEDIATE - Coaching by rep

### F1 - a rep with no calls would read as overdue
overdue = calls30 > 0 && feedback30 === 0.
gate-or-promise: gate (feedback.test.ts "a rep with no calls is not overdue")
