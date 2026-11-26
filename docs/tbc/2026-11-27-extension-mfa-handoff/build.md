# BUILD - Extension MFA handoff

### Middleware matcher
write-path: none.
read-path: /extension/:path* now runs middleware: a session owing its code is sent to /login/verify?next=/extension/connect?ext=….
