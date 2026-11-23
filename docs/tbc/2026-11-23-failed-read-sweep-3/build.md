# BUILD - Third sweep: failed reads shown as "none"

No migration. No env keys.

### Team passwords (Team → Team passwords; Add user → New user)
write-path: none changed.
read-path: GET /api/team/passwords → ok: list · not ok / no response: "Couldn't load the team passwords" (was: "No team
password yet — create one").

### A call's page (Sales Coach and Remote Sales)
write-path: "Generate growth review" (paid) held while the review couldn't be read; the "why" composer (append-only)
hidden while the rep's existing read couldn't be read.
read-path: SessionDetailView load → per part (review, summary, why) a failed flag → "Couldn't load …" in its place.
