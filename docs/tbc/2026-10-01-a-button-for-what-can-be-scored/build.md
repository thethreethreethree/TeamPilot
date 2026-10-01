# BUILD - a button for what can be scored

### The count separates what a press can score

- **write-path:** `pitch-score/backfill/route.ts` GET returns `{ unscored, unscorable }`: sessionsWithRepSpeech
  counts each candidate's 'agent' rows (chunked `.in()`, through the caller's client) against the exported
  `MIN_AGENT_SEGMENTS`, and only for sessions asked about.
- **read-path:** route tests: 2 scorable + 2 unscorable from 4; exactly-at-threshold vs one-below.

### The panel tells, and never offers the button for them

- **write-path:** `UnscoredBacklog.tsx`: a line "N more have no rep speech, so they can't be scored"; headline
  "Everything that can be scored has been" when only those remain; recount when a run ends.
- **read-path:** render tests (3 new) and the `unscored-backlog-unscorable` capture, opened in both themes.
