# REMEDIATE — the rubric has three consumers and no door

### F1 — a fourth consumer exists and the rubric has no door
gate-or-promise: gate

The route exists and eight tests cover it. The one that matters is the last: it asserts the body
equals `SECTIONS`, `ELEMENTS`, `BONUSES` and `VIOLATIONS` exactly, so a future edit that renames or
rounds a field fails rather than handing the phone a different methodology from the one that
produced the scores it renders.

Two further gates that are easy to overlook: an unauthenticated caller gets 401, and the route
creates no Supabase client — asserted by the test file mocking neither `createClient` nor
`callerScopedDb`, so adding a database read breaks the mocks and forces someone to think about
whose rubric is being returned.

### F2 — the obvious client-side substitute is wrong in a way that hides
gate-or-promise: gate

A test asserts the six section maxima sum to `BASE_MAX`, and pins the specific inversion the rule
turns on: `8.6 / close.maxPoints < 4.7 / transitions.maxPoints`. A client that reconstructs maxima
from `elementStats` cannot satisfy that on a rep with an ungraded element, which is the case the
sum would get wrong.

### F3 — the build plan asserted this data was already deployed
gate-or-promise: promise

No gate. A claim in a planning document is not a behaviour a test can hold. It was corrected at
source: `MOBILE-BUILD-PLAN.md` §6 now records that no route served the rubric and that this one was
added, rather than leaving a reader to trust the original sentence.
