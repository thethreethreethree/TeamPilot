# THINK — paying the debt instead of chasing the yield

started_at: 2026-09-25T03:30:00Z

## Why this and not `/kpi` or `/team`

By yield, `/team`'s tree (18 sites) was next. I took `LiveCoachingPanel` (2) instead.

The previous closure said, in its own words, that this component was "fixed by pattern and still
unseen, which is precisely the category this session keeps promising to stop shipping." Writing
that and then moving to a higher-yield route would have made the sentence decorative.

It is also the surface that runs **while a rep is at a door** — the only screen in this product
where a defect costs a live conversation rather than a browsing session.

## The exception this build makes, deliberately

Every rule this session established says capture the ROUTE, not the component. `/[id]` was captured
in the previous build and this panel is in its tree.

But the panel only renders anything once a websocket is live, a transcript is arriving and a cue
has been generated. No route-level fixture produces that, so the route capture photographed its
idle shell — twice — and the component stayed unseen while its route was marked done.

So: mocked at `useLiveCoaching`'s return shape, read from `useLiveCoaching.ts:1848-1878`. Not
imagined. This session has already paid for an imagined mock twice — `arm`, then `start`, both in
the door recorder, the second one directly beneath a comment I had written warning about the first.

## What I expected to find

Two white-alpha sites from the sweep, and nothing else. The panel is heavily commented and
carefully reasoned; its author left notes about honesty, restraint and what the coach may claim.

I did not expect to find that its own container has been invisible on cream since light mode
existed.
