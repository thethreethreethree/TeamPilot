# REMEDIATE

### Error reporting was off in production while the code assumed it was on

gate-or-promise: gate

/api/health reports errorReporting (route.test.ts pins both guards); the DSN itself is the founder's blocking setup step.

### A mock that named only one Sentry function

gate-or-promise: promise

Fixed in the one test; a new Sentry call elsewhere needs its mock updated, which the failing test will say.

### publicMessage.ts said "Sentry keeps the exception"

gate-or-promise: promise

Comment corrected; no gate can check a comment's claim about Sentry.
