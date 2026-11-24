# REMEDIATE - Turn off FYI bell notices

### F1 - the switch sent the opposite of what it showed
muted = on (turning an on notice off mutes it).
gate-or-promise: gate (NotificationMutesPanel.render.test.tsx, both directions)

### F2 - the badge would count notices the bell hides
notMuted() on both queries.
gate-or-promise: gate (bell route test)
