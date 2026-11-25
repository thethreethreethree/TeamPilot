# BUILD - Fixes from the 26 Nov review

Migration 0345_hide_review_fixes.sql (applied; DB at 0345). No env keys.

### A long call with a hide phrase late in it
write-path: transcript lands → scanCallForHidePhrases reads every line (paged) → call_hides.
read-path: the call is hidden from its managers even when the phrase comes after line 1,000.

### A manager's lists in a company with many hides
write-path: none.
read-path: service-role lists ask rss_hidden_calls_for once (paged) and leave out every hidden call, at any count.

### A manager reads events
write-path: none.
read-path: a hidden call's dispute events (pitch:<id>) are refused like its AI reads.

### A followed search
write-path: none.
read-path: Search counts calls that ended since you last looked; a count that couldn't finish shows "new?".

### Switching team on Coaching
write-path: none.
read-path: the inbox empties and reloads; a refused team shows the failure, never the previous team's rows.
