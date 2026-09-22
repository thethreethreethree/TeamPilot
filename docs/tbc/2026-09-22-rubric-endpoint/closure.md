# CLOSURE — the rubric has three consumers and no door

This is a small route and the interesting part is why it did not already exist.

`rubric.ts` was written as data rather than logic precisely so its three consumers could not each
grow a copy and drift. That reasoning was right, and it was complete for a repository where every
consumer can `import`. The mobile app is the first consumer outside that boundary, and the property
that made the file safe — everyone reads the one object — silently stopped holding the moment a
consumer could not reach it.

So the failure was not a missing endpoint. It was a correct rule whose precondition changed without
anything saying so.

The trap underneath it is worth more than the route. The natural client-side substitute — summing
`maxPoints` across `elementStats` — is wrong only for reps who have not been graded on every
element, which means it would have passed every check written by someone testing with a full
dataset, and shown the wrong section as a rep's weakest in exactly the early-career case the board
matters most.

## Residuals

```json
[
  { "id": "R1-rubric_config-is-still-read-by-nothing",
    "item": "The guide requires the sheet be \"rendered from rubric_config so it never goes stale\". This route serves `rubric.ts`, not the table. `rubric_config` is named in migration 0252 and read by nothing in src/.",
    "why_skipped": "Making the table the source of truth needs a migration, a seeding path and a versioning story, and none of it is required to unblock the phone. Serving the real source of truth is strictly more honest than serving an empty table.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T13:45:00+08:00",
    "outcome": "OPENED and left open deliberately. The guide's intent — one rubric, never stale — is satisfied today by there being exactly one rubric object and every consumer now reading it. The table becomes worth building when the rubric needs editing without a deploy, which nobody has asked for." },

  { "id": "R2-no-client-has-called-this-route",
    "item": "The route is tested against mocks. No mobile screen consumes it yet, and it has never been called over HTTP by anything.",
    "why_skipped": "The mobile boards that need it are the next build step; wiring a consumer was out of scope for adding the door.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T13:46:00+08:00",
    "outcome": "OPENED rather than noted, because it is the residual most likely to bite. Mocked route tests prove the handler's logic and say nothing about whether a phone's bearer token resolves through `resolveApiAuth` on this path. Every other pitch-score route this app calls has the same auth shape, which is the reason to expect it works and not evidence that it does. It will be exercised by the Breakdown board in the next step, and until then this route is UNTESTED over the wire." },

  { "id": "R3-cache-header-is-a-guess-at-the-right-duration",
    "item": "`private, max-age=3600` was chosen to be short enough that a rubric correction reaches a phone the same day, and long enough that opening the sheet twice costs one request.",
    "why_skipped": "There is no measurement to set it from — no client has called it yet, and the rubric has never been corrected in production.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T14:02:00+08:00",
    "outcome": "OPENED because it was ranked most-confident-irrelevant, and the confidence was WRONG — which is the whole point of ranking by it. The duration is not the issue. The header is very likely INERT for the one client it was written for: `coachGet` in the mobile app calls the global `fetch` with no `cache` option [OBSERVED — src/lib/coach-api.ts:171-179], and React Native's fetch does not implement an HTTP response cache the way a browser does. So the docblock's claim that a phone 'should not refetch thirty elements to open a sheet twice' is aspirational, not a behaviour this header delivers. The header is kept — it is correct for a browser or a CDN and costs nothing — but the comment no longer promises the phone anything. If request count on a doorstep turns out to matter, the fix is in the app: hold the rubric keyed by `version` and refetch only when the version changes, which is stronger than any duration because the rubric is immutable per version. Recorded rather than fixed, because no mobile client calls the route yet and optimising an unmeasured request is the kind of confident work this register exists to catch." }
]
```

## Not opened

- **"Pitch Score System — Engineering Implementation Guide"**, named on guide page 2. Not in the
  repository. It does not govern this change — no scoring behaviour was added — but it is the
  document that would say whether `rubric_config` was ever meant to be the runtime source.
- **No screen was rendered.** The route was exercised by unit tests against mocks only.
