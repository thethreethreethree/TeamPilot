# REMEDIATE - Service-role lists stop naming hidden calls (stage 2b)

### F1 - managers could see hidden calls in service-role lists
gate-or-promise: gate (hidden tests: inbox, metrics, list, disputes, calibration, chats, vendor)
### F2 - a manager could comment on, share or correct a hidden call
gate-or-promise: gate (comment, share, override, calibration POST tests)
### F3 - the rule's admin exemption ignored the viewer's company
gate-or-promise: gate (0340; replay)
### F4 - the hidden route re-derived "can see"
gate-or-promise: gate (route uses hiddenFrom; test drives its verdict)
