# BUILD - A company phrase hides a call (stage 1)

Migrations 0337_hide_by_phrase.sql and 0338_hide_by_phrase_rls_restated.sql (applied; DB at 0338). No env keys.

### An admin adds a phrase
write-path: Settings → Protection → "Hide calls by phrase" → Add phrase → POST /api/coach/remote/hide-phrases →
hide_phrases + audit call.hide_phrase_add; after the response, scanCallForHidePhrases over up to 500 phone/video calls of
the last 90 days → call_hides.
read-path: the panel lists the phrase with "hiding N calls"; the message says how many recent calls are being checked.

### A new call contains a phrase
write-path: generateSessionArtifacts (and a transcript edit) → scanCallForHidePhrases → call_hides.
read-path: a manager's call list, search and the library no longer show it; opening it shows "This call is hidden by a
company rule (it contains "…")"; the rep and admins open it as before with a banner.

### An admin unhides a call, or retires a phrase
write-path: Unhide on the call page → POST /api/coach/remote/[id]/hidden → call_unhides + audit call.unhide. Retire in the
panel → DELETE /api/coach/remote/hide-phrases → hide_phrase_retirements + audit call.hide_phrase_retire.
read-path: the call is back for its managers; a retired phrase leaves the panel and hides no new calls.
