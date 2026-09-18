# REMEDIATE — a shared password nobody is forced to rotate is not temporary

### F1 — a forced password rotation that only guards one of the product's two front doors
gate-or-promise: gate

`requireExtensionAuth` now returns 403 with `code: "must_change_password"` when the flag is set,
placed at the single authority every extension route funnels through rather than in each route.

The gate is `src/lib/api/__tests__/extensionAuth.test.ts` — four tests, and the one that matters
most asserts the flag being **false** still passes. A gate tested only in its denying direction is
the shape that rots: the exemption term is what gets dropped in a copy, and a check that always
denies looks identical to a check that works until someone rotates their password and cannot work.

Three mutations each fail exactly one named test: deleting the check, inverting the comparison, and
collapsing the two-step profile read into one select.

What the gate does not cover, named rather than implied: it proves the server refuses. It does not
prove a rep can read the refusal. Nothing here drove a browser against a deployed build, so the
legibility of that message in the extension's error surface is unverified and is carried as R4.

### F2 — every member added through "Add agent" was named after their email prefix
gate-or-promise: promise

No gate. The behaviour is "a name the admin typed survives to the profile row", and the honest
position is that the existing route tests already assert the upsert payload with
`objectContaining`, so they pass whether or not `full_name` is in it. Adding an assertion that the
key is present would pin the happy path but not the thing that actually broke — which was nobody
passing a name at all, from a UI with no field to type one into.

Declining the gate rather than building a weak one is A33's escape hatch used deliberately: the
precise detector would have to be "no creation path silently drops a user-supplied display name",
which has no chokepoint every such path must cross.

The promise instead: the field is in the dialog, the route accepts it, and omitting it reproduces
the previous behaviour exactly — so this cannot regress *silently* into something worse than where
it started. If it regresses, it regresses back to today's known state, not past it.

### F3 — the suite used to verify all of the above was not running a third of itself
gate-or-promise: gate

The gate is the suite itself, which is the point: 646 of 647 files now load, so a future breakage of
the same class shows up as files-not-running against a known baseline rather than as an ambient
number nobody has a reference for.

The measurement is recorded in check.md in both directions — 294/2110 before at exit 1, 646/4336
after at exit 0 — because a count with nothing to compare it to is how this went unnoticed in the
first place.

What is NOT gated, and is the real residual risk: nothing fails if `resolve.tsconfigPaths` is
removed and the plugin reinstated. The next author debugging path resolution could find the unused
`vite-tsconfig-paths` in `package.json`, assume it is load-bearing, and restore the exact
configuration this fixed. That is R5, and it is why R5 is opened rather than dismissed as a tidy-up
— the dependency being harmless at runtime is not the same as it being harmless to a reader.
