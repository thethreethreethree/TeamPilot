# BUILD - Lead source on prospects

Migration 0313 (applied). No env keys or dashboard settings.

### Set where a prospect came from
write-path: Pipeline → New prospect → "Lead source" box (suggests sources in use) → POST /api/coach/remote/prospects
{ …, source } → rss_create_prospect(…, p_source) in one transaction; or the prospect card's Source box → POST
/api/coach/remote/prospects/[pid] { action: "set", kind: "source", value } → a 'source' event (eventValue, 0313 check).
read-path: remote_prospects_current.source (latest event) → listProspects → the Pipeline; the Ask box's context names it.

### See deals by source
write-path: none.
read-path: Pipeline → Sources (follows "Whose pipeline") → sourceBreakdown over the prospects already loaded: per
source — prospects, open count and value, won count and value, lost, win rate on closed deals ("—" until one closes);
"No source set" last; a line saying how many prospects have a source.
