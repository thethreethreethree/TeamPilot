# REMEDIATE - AI-suggested topic groups, approved by a manager

### F1 - accepting one suggestion would have dropped the others from the screen
TopicGroups rendered outside MarketView's reloading branch.
gate-or-promise: gate (TopicGroups.render.test.tsx "keeps the other suggestion")

### F2 - one-off topic labels can be one customer's specifics
2+-call rule enforced in candidates() and in the save route.
gate-or-promise: gate (suggest route test: one-off label not in prompt; topic-groups route test: one-off refused) +
promise (OPEN.md: erasure does not reach group members)
