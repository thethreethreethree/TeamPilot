# BUILD - Macro Mode follows the PDF for everyone

No migration. No env keys.

### A manager turns Macro Mode on
write-path: Calls → Macro Mode switch → profile setting (0303, unchanged).
read-path: the Remote Sales tabs read Today · Pipeline · Calls for every role (RemoteSalesShell); Pipeline shows
Open / Closed Won / Closed Lost and the six-column table, with "Whose pipeline" for a manager (RemotePipeline);
Today shows the brain dump and yesterday only (RemoteToday).

### Opening Remote Sales for the first time today
write-path: RemoteCallsHome effect → localStorage rss-macro-today-shown = today → router.replace(/today).
read-path: Today: "Hello <name>, what's our to-do list for the day?"; the next visit to Calls stays on Calls.

### A finished call in Macro Mode
write-path: none (reads only).
read-path: SessionDetailView Macro branch → stage chips only while processing → (lg) Highlights / Coaching / Next
Meeting on the left, the player (play, 15 s, speed, talk lanes) on the right; "Show the full call page" keeps
everything else.
