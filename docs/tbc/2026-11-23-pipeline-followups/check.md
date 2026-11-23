# CHECK - Pipeline Ask: follow-ups on the page

## Commands

```
npx vitest run RemotePipeline.ask.render askPipeline.test ask-pipeline route → 13 passed (first question sends no history; the follow-up sends the first turn; both shown; New conversation clears; history trimmed to the last 4, answers to 2000 characters)
```

## Findings

No findings: the follow-up is the same AI call with the earlier turns as marked context; nothing is written.

## Final

```
npm run check → exit 0 · Test Files 900 passed | 1 skipped · Tests 6662 passed | 15 skipped
```
