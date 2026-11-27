# REMEDIATE



Caught by the invariant audit before commit, fixed here: (1) the POST route delegated its key check to the handler, so
the route file showed no gate — authenticateApiKey now runs at the top of the route and the handler takes its result;
(2) the new upload writer wasn't known to the nightly unreferenced-upload sweeper (it would have deleted the stored
recordings after 24 h) — registered in DATED_UPLOAD_WRITERS with coaching_sessions.audio_asset_url, the column the
sweeper already reads.
