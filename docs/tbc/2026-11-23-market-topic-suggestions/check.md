# CHECK - AI-suggested topic groups, approved by a manager

## Commands

```
npx vitest run market (lib + route), topicSuggest, topic-groups routes, TopicGroups.render, InsightViews.render → all passed (market route 13, panel 3, lib 11)
node scratchpad/replay0319.mjs (PGlite, every migration then 0319 again) → failures: 1 (0315: role "authenticator" does not exist — local only, known) · refused: one member · refused: bad source · refused: blank name · second retirement refused: 23505 · after update/delete attempts: {"name":"Price","groups":1,"retirements":1} · policies: select + mfa_required on both tables
npm run db:apply → applied 0319 · ✅ ALL 33 invariants hold · verify:live passed
node scratchpad/check0319.mjs (production) → both tables relrowsecurity true; select + mfa_required policies; no_update/no_delete rules on both
npm run check (before the record) → ✗ rls:audit (6 write ops) → allowlisted with reasons → ✗ invariant:audit (manager route + service role) → TREE_ROUTE_ALLOWLIST with reason → every code gate passed
```

## Findings

### F1 - accepting one suggestion would have dropped the others from the screen
class: a child panel inside a view that clears itself on reload.
sweep: TopicGroups is the only panel MarketView reloads around; moved outside the counted view; render test asserts the
second suggestion survives an accept.
severity: medium (layer 3)

### F2 - one-off topic labels can be one customer's specifics
class: copying call-derived text into a company-wide table that legal erasure does not reach.
sweep: only topics on 2+ calls can be sent to the model (candidates) or saved (POST check); tests: "Jane's dog" never
reaches the prompt; a one-off label is refused. Erasure reach is recorded as a residual, not claimed.
severity: medium

## Final

```
npm run check → exit 0 · Test Files 891 passed | 1 skipped · Tests 6602 passed | 15 skipped
```
