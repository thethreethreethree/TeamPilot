# CHECK - E15–E18 review fixes

## Commands

```
node scratchpad/probes/cidr.mjs → production: '::ffff:1.2.3.4'::cidr reads back '::ffff:1.2.3.4/128' (the review's lockout case, confirmed); '01.2.3.4' → 1.2.3.4/32
npx tsc --noEmit -p . → exit 0
npx vitest run src/lib/api, askCoach.test, AskCalls.render, ask route, settings routes → 189 passed
npm run check → gates the commit
```

## Findings

No findings left open beyond the residuals in closure.md. Fixed from the review: refused requests filling the daily count, mapped entries that never match, the scope answered before the address, made-with folder parents, folders inside an archived one, snippets unmarked, deep Ask failing after paid batches, serial batches near the time limit, non-citation brackets deleted, uncited batch answers dropped. Confirmed sound by the review: the address parser, x-real-ip, every /api/v1 route through authenticateApiKey, to-dos and flows pins.
