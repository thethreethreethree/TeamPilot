# CLOSURE - Failed reads shown as "none" (the null form)

## What is true now

When one of these screens can't load its data it now says so, instead of looking empty: the rep scoreboard, My
progress, a call's saved dissect and earlier Ask Coach questions, the Training "Assign" picker, the Pipeline's "Whose
pipeline" list, Search's saved searches and rep/tracker filters, the role-play page's assigned practice and scenario
test, and C.A.R.E activity on the Command Center (it joins the existing "couldn't load" banner). A test now fails if
any screen maps a failed read to null again, except seven listed reads that only fill in names or labels.

## Residual

```json
[
  {"id": "R1-label-reads", "item": "Seven label reads still show less decoration on failure (names, greeting, voice badge, rank).", "why_skipped": "A failure there never states a false 'none'.", "confidence_it_does_not_matter": "high", "opened_at": "2026-11-23T08:40:00Z", "outcome": "Listed with reasons in NULL_ALLOWED."},
  {"id": "R2-other-shapes", "item": "Other spellings (e.g. `if (!r.ok) return null`) are not matched by either pattern.", "why_skipped": "Each spelling needs its own safe pattern.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-11-23T08:40:00Z", "outcome": "Opened: OPEN.md."}
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched.
