# BUILD - Pipeline Ask: follow-ups on the page

No migration. No env keys. Nothing stored.

### Ask a follow-up
write-path: none — the thread lives in the page.
read-path: Pipeline → Ask box → POST /api/coach/remote/ask-pipeline { question, scope, today, history } → cleanHistory
(last 4, trimmed) → askPipeline → historyBlock before the question → askCoachTurn → the answer joins the thread on
screen ("This conversation isn't saved."); "New conversation" or switching whose pipeline clears it.
