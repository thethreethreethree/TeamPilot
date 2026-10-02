# REMEDIATE

### An AI outage longer than 3.5 minutes destroyed every pitch recorded during it

gate-or-promise: gate

worker.test.ts outage cases fail if the branch is removed (7 failures).

### Every AI call waited 45 s during an outage

gate-or-promise: gate

providerHealth.test.ts fails if the provider stops consulting the breaker (3 failures).

### "Cue request failed (502)." and "see console" shown to a rep

gate-or-promise: gate

cueFailureMessage.test.ts fails on a console pointer or a "nothing to add" claim.
