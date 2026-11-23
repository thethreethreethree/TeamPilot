# REMEDIATE - Team call calendar

### F1 - the Ask box opened closed prospects on a tab that wasn't showing
Fixed: goTo() sets the prospect's tab and the List view before opening it; used by the Ask box and the calendar.
gate-or-promise: promise (no component harness for remote-sales screens — OPEN.md "no component test renders the Ask box")

### F2 - a calls-week read could be cut at 500 sessions
Not changed: a team would need 500 recorded calls in one week; prospects are already capped at 500 by listProspects.
gate-or-promise: promise (OPEN.md "calendar week read is capped at 500 calls")
