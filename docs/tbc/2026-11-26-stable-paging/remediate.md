# REMEDIATE - Stable order for paged reads

### F1 - OFFSET paging over non-unique orders
gate-or-promise: gate (tests assert the order for today's reads); promise for the older ones (OPEN.md)
### F2 - a return-type change outran the deployed code
gate-or-promise: promise (deploy right after such a migration)
