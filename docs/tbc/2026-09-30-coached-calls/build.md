# BUILD - "scored" means the rubric

### The coaching grade's count reads "coached calls"

- **write-path:** `AgentGradeBadge.tsx:194` and `AgentEloBadge.tsx:162` print `{e.gamesPlayed} coached call(s)`;
  their provisional lines read "Under 5 coached calls"; `analytics/page.tsx:550` empty state reads "No coached
  calls yet".
- **read-path:** `scoredMeansRubric.test.ts` (4): none of the three renders "scored call", and both badges name
  "coached call".
