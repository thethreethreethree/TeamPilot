# BUILD - Smart trackers: the same idea in any words

Migration 0329_smart_trackers.sql (applied 2026-11-23; committed with ace7b9f5). No env keys (the existing AI key).

### A manager adds a smart tracker
write-path: Settings → Coaching → Keyword trackers → "Same idea, any words" → name, side, example sentences → POST
/api/coach/remote/trackers {kind: "smart"} → requireSalesCoachManager → cleanExamples → active-smart count < 10 →
keyword_trackers insert (kind smart) → after(): scanSmartTrackers(each of the last 10 visible sales calls,
{onlyTrackerId}) → tracker_hits (matched = the example, at_ms = the line's time).
read-path: the list shows the tracker with a "Smart" label and its examples in quotes; the status line says "Reading
your last N calls for it now…"; each call's tracker chips show "<name> · <time> · <who> · like “<example>”".

### A call's transcript lands
write-path: generateSessionArtifacts → scanSmartTrackers (one AI read for all active smart trackers; none → no call) →
tracker_hits.
read-path: the call's tracker chips (/api/coach/remote/[id]/tracker-hits, smart flag from keyword_trackers.kind).

### A rep corrects a line
write-path: transcript-edit → new version → after(): carrySmartHits(version, edited seq) → tracker_hits at the new
version for every untouched line (no AI call).
read-path: the call's chips still show the smart hits on the latest version; the edited line's hit is gone until the
next notes refresh reads it again.
