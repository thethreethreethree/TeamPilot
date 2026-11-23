# BUILD - Ask Coach across the pipeline

No migration. No new env keys or dashboard settings (uses the AI provider Ask Coach already uses).

### Ask a question about a pipeline
write-path: Remote Sales → Pipeline → "Ask about this pipeline" box (RemotePipeline.tsx AskPipeline, scope = the
"Whose pipeline" choice) → POST /api/coach/remote/ask-pipeline { question, scope } (rate limit 10/min) → askPipeline
(src/lib/coach/remote/askPipeline.ts): listProspects + remote_prospect_calls + latest remote_call_briefs per prospect via
the caller's client → askCoachTurn (PIPELINE_SYSTEM + CONVERSATION_IS_DATA). Nothing is written.
read-path: the answer shows in the box; each [P#] is a button with the prospect's name that opens it (?p=); a line under
it says how many prospects it read and that it used call summaries, not transcripts.
