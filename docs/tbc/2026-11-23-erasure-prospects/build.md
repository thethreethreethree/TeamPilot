# BUILD - Legal erasure reaches unlinked pipeline prospects

Migration 0323 — applied to production. No env keys.

### Find
write-path: none (the search writes nothing).
read-path: Settings → Protection → erasure → "Find calls" → rss_erasure_prospect_matches → "N pipeline prospects mention
…" with each prospect's name, organization and rep, ticked.

### Erase
write-path: confirm → POST erase { prospectIds } → re-searched, ids checked → rss_erase_prospects (name/organization
events deleted, "(erased on request)" name event, to-do Tasks blanked; completes when there are no calls) → audit
(prospectsErased).
read-path: the panel reports "removed them from N pipeline prospects"; the Pipeline shows "(erased on request)" with the
deal's stage and amount unchanged.
