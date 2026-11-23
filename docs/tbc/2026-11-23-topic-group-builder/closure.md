# CLOSURE - Make and edit topic groups by hand

## What is true now

On Market → Topic groups, a manager can "Make a group" (name it, find and tick topics raised on two or more calls that
aren't already grouped, save) and "Edit" an existing group (it opens with its topics ticked; saving replaces it and
keeps the old one in the history). No AI call is involved in either.

Also: the record gate no longer passes on the wrong build. A new record folder committed without its think.md now
fails tbc:freshness; before, every gate quietly checked the previous build instead (it happened during this build).

## Residual

```json
[
  {"id": "R1-top-150", "item": "The form lists the 150 most-raised groupable topics (topicSuggest MAX_CANDIDATES); a rarer topic beyond them can't be picked, though the save would accept it.", "why_skipped": "Production has 669 topic groups, most on one call (not groupable); topics on 2+ calls are far fewer than 150 today.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T20:46:00Z", "outcome": "Accepted; recorded here. Revisit if a company passes 150 groupable topics."},
  {"id": "R2-tree-view", "item": "Which topics may be grouped is read through the manager's own view of calls (their reporting tree); two managers can see different lists for one company-wide setting.", "why_skipped": "Reading every call in the company with the service role would bypass the tree; a manager grouping only what they can see is the safer side.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T20:46:00Z", "outcome": "Accepted; recorded here."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
