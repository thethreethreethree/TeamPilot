# REMEDIATE - A time on the next call

### F1 - changing the date on the card would have dropped the time
setNextCall reads both inputs and sends { date, time }.
gate-or-promise: gate (RemotePipeline.nextCallTime.render.test.tsx)
