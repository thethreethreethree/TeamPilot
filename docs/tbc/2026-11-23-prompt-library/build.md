# BUILD - Ask Coach prompt library

No migration. No env keys.

### Pick a ready question
write-path: none until the person presses Ask (then the existing Ask Coach / Ask-pipeline save paths).
read-path: a call page → Ask Coach → "Prompt library" (11 prompts: Coach me, Read the buyer, After the call); Pipeline
→ "Ask about this pipeline" → "Prompt library" (9 prompts: This week, Patterns, Report) → PromptLibrary.tsx renders
promptGroups(scope) from src/lib/coach/remote/promptLibrary.ts → picking fills the input and closes the list.
