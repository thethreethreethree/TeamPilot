---
started_at: 2026-11-26T00:31:57Z
trigger: Gong ledger F12.7 "Streams" (P2, PARTIAL) — "Not built: a bell notice or email when new calls match" a followed search.
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - The bell tells you when a followed search has new calls

## What the record shows

0342 + savedSearchFollow.ts: a followed search's "new calls" are counted on read, through the follower's OWN client
(newMatches → runCallSearch), so their reporting tree and hidden calls (0337/0341) decide. Nothing is stored. The bell
(now in both shells, 3d541696) shows stored rows from manager_notifications. A stored "new matches" row would need a
server job to run each follower's search with the service role — re-deriving RLS's tree and hide rules (§2.2), the
exact class reviews 3 and 4 kept finding. So the notice is derived the same way the count is: the bell asks
/api/coach/remote/saved-searches, which already returns newCount per followed search.

## Design

- The bell fetches saved searches on load and every 10 minutes (each followed search runs one search; 60 s would be 10×
  the load for a list that changes slowly). Followed searches with new calls show under "Searches you follow" and count
  once each on the badge. newCount null (couldn't check) is not shown.
- The link opens Search with the saved query plus saved=<id>; the page records "seen" (the same event openSaved writes)
  for that search if it is followed and has new calls; the bell drops the item on click.
- No email (email isn't configured in production) and no shared streams — recorded.

## Session-read manifest

```json
[
  {"id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "Why the notice isn't stored: the count can only be computed with the follower's access; a stored notice needs a job that would re-derive that access.",
   "how_this_build_will_embody_it": "The bell reads the same on-read count the Search page shows."},
  {"id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-30", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "The methodology must be in the working tree and read this session before acting.",
   "how_this_build_will_embody_it": "Sections printed in full at 2026-11-26T00:33:04Z, after started_at."},
  {"id": "§1.5", "source_file": "CLAUDE.md", "line_range": "64-76", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "Holistic: each bell in each open tab now runs every followed search; the saved-searches route is rate-limited at 60/min.",
   "how_this_build_will_embody_it": "A 10-minute poll, not the bell's 60 s one."},
  {"id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-100", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "Layer 3: the notice must lead somewhere and then go away, or it nags.",
   "how_this_build_will_embody_it": "It opens the search with its filters, the page marks it seen, the bell drops it."},
  {"id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-158", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "Look past the task: the Search page took filters from the URL but had no way to know a link was a saved search.",
   "how_this_build_will_embody_it": "saved=<id>, handled only for a followed search with new calls (tested both ways)."},
  {"id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-180", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "Email would need production email config, which /api/health shows is off.",
   "how_this_build_will_embody_it": "No email; recorded as residual."},
  {"id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-316", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "What counts as a new call for this person is the database's verdict through their client.",
   "how_this_build_will_embody_it": "The bell consumes the route's newCount; it computes nothing."},
  {"id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-345", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "'Seen' is an appended saved_search_events row, as before.",
   "how_this_build_will_embody_it": "No new table; the same event."},
  {"id": "§3.1.1", "source_file": "CLAUDE.md", "line_range": "347-361", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "The bell shows a search's own name and a count — no customer text.",
   "how_this_build_will_embody_it": "Nothing new for erasure to reach."},
  {"id": "§3.3", "source_file": "CLAUDE.md", "line_range": "368-379", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "The person chose to follow; the bell reports, it doesn't judge.",
   "how_this_build_will_embody_it": "A count and a link."},
  {"id": "§6", "source_file": "CLAUDE.md", "line_range": "450-456", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "Checklist item 0: any decision goes to the founder as a picker.",
   "how_this_build_will_embody_it": "No new decision: following is the person's own choice (0342)."},
  {"id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-458", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "Methodology in the working tree, consulted not remembered.",
   "how_this_build_will_embody_it": "Assets printed by line this session."},
  {"id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-598", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "No citation without a session read.",
   "how_this_build_will_embody_it": "Every id here was printed at its line range after started_at."},
  {"id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-774", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "A lesson in prose returns; the class needs a gate.",
   "how_this_build_will_embody_it": "Bell and Search render tests for the badge, the link, seen, and the not-followed case."},
  {"id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1005", "read_at": "2026-11-26T00:33:04Z",
   "why_it_governs": "Verified is a claim about a command that was run.",
   "how_this_build_will_embody_it": "check.md names each command with its result."}
]
```
