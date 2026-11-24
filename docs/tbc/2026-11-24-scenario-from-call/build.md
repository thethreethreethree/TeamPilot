# BUILD - Practice scenario drafted from a real call

No migration. No env keys.

### A manager turns a call into a practice scenario
write-path: call page → "Make a practice scenario from this call" → Remote Sales → Training?fromSession=<call> →
"Draft it from the call" → POST /api/coach/remote/scenarios/draft (manager, call they can open, finished phone/video
sales call, AI guidance on) → draft only → the manager edits → Save → POST /api/coach/remote/scenarios
{…, sourceSessionId} → training_scenarios.
read-path: the form shows the drafted title, prospect, situation and skill with "Drafted from the call — check it, change
anything, then save."; the saved scenario lists in Training, linked to the call.
