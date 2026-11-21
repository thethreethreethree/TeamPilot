# REMEDIATE - RSS Phase 9

### F1 - shared secret
endpointSecret = HMAC(master, endpoint id); the master never signs; tests pin "another endpoint's secret fails".
gate-or-promise: gate (webhooks.test.ts)

### F2 - mutable delivery log
webhook_attempts rows; webhook_deliveries/attempts under no-update/no-delete rules (INVARIANT 33 covers them).
gate-or-promise: gate (INVARIANT 33 + the replay)

### F3 - injected login text
Callback redirects with codes; the page maps codes to fixed sentences.
gate-or-promise: gate (oauthProviders.test.ts, callback route test)

### F4 - silent lookup failure
The import uses findAuthUsersByEmails (throws → 503, nothing imported). The existing helper is unchanged here.
gate-or-promise: promise (OPEN.md: make findAuthUserByEmail fail loud too; its callers must then handle the throw)

## Addendum 2026-11-20
F4 promise kept: findAuthUserByEmail now throws on a failed listing page; its three callers (createInvitation,
add-member existing/new) answer 503 with a sentence; admin.findAuthUserByEmail.test.ts pins a page-2 failure.
Missing service-role env remains a soft-fail, as its existing test records as intended.
