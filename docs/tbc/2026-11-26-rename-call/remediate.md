# REMEDIATE - Rename a call from its page

### F1 - the control could send a status change
gate-or-promise: gate (render test asserts the exact body)
### F2 - managers would see a control that always fails
gate-or-promise: promise (render condition viewerId === agentId)
