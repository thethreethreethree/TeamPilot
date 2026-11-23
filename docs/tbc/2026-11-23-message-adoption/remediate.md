# REMEDIATE - Message adoption on trackers

### F1 - a capped read of hits could undercount adoption
Fixed: paged reads.
gate-or-promise: gate (route test reads through the paged path; a failed read is a 500)

### F2 - no adoption goal per message
gate-or-promise: promise (OPEN.md "adoption goals per tracker")
