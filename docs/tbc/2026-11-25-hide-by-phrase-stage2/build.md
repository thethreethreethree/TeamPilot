# BUILD - A hidden call's remaining rows, and a list of hidden calls (stage 2a)

Migration 0339_hide_by_phrase_stage2.sql (applied; DB at 0339). No env keys.

### A manager looks for a hidden call's leftovers
write-path: none new — call_hides (0337) is the record; 0339 adds read rules.
read-path: comments, score evidence, corrections, tracker hits, talk stats, after-call summary, live cues, library items
and bell notices about the call return no rows to anyone but its rep and company admins.

### An admin finds a hidden call
write-path: Unhide on the call page → POST /api/coach/remote/[id]/hidden → call_unhides (0337).
read-path: Protection → "Hide calls by phrase" → "Hidden calls (N)" → each call's name, rep, date and phrases, linking to
/dashboard/remote-sales/calls/<id>; GET /api/coach/remote/hide-phrases returns hiddenCalls.
