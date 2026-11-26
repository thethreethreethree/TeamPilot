# BUILD - Acting on the third review

Migration 0351 (applied to production; verify:live 33/33). No env keys.

### A manager deletes or saves a rep's recording
write-path: call page → "Delete recording" / "Save recording" → POST /api/coach/sales-session/<call>/delete-recording
(or save-recording) → for a caller who is not the call's rep: treeAllowsRep + hiddenFrom → unreachable: 404, nothing
written; reachable: the service-role update of coaching_sessions as before.
read-path: the session read in the same route (service role, company-checked), now followed by the two verdicts.

### A rep reads the questions on a call with no recording
write-path: none.
read-path: call page → "Questions asked by the rep (N)" → with no audioUrl the questions show as text and "This call
has no recording, so these can't be played." GET /api/coach/remote/<call>/stats → `questions`, `audioUrl`.

### An admin erases a customer whose callback signal was filed under another company
write-path: erasure route → rss_erase_sessions (0351) → `update signals … where source = any (task_subjects)`.
read-path: none (the scrubbed signal is read nowhere afterwards with the title).

### Invariant 43 sees every call table
write-path: none.
read-path: scripts/invariant-audit.mjs → FILES → routes using createAdminClient that read a hide-covered table or call events.
