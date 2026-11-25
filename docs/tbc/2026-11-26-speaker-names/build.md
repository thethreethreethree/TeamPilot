# BUILD - Name the speakers on a call

Migration 0343_call_speaker_names.sql (applied; DB at 0343). No env keys.

### The rep names the customer
write-path: call page → Full transcript → "Name the speakers" → Customer "Dana Lee" → Save → POST
/api/coach/remote/<call>/speaker-names {speaker: "customer", name} → call_speaker_names.
read-path: the transcript's customer lines are labelled "Dana Lee"; anyone who can open the call sees it (GET).

### Clearing a name
write-path: empty the field → Save → a row with an empty name.
read-path: the label goes back to "Customer".

### Erasure
write-path: an admin's erasure request for that customer → rss_erase_sessions deletes the call's speaker names.
read-path: the erasure counts include speaker_names; the transcript shows plain labels (and no words).
