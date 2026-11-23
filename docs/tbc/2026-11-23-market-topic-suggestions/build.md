# BUILD - AI-suggested topic groups, approved by a manager

Migration 0319 (market_topic_groups, market_topic_group_retirements) — applied to production. No env keys (uses the
existing AI provider through runBrainCall, engine "rss_topic_groups", controlExempt).

### Ask for suggestions
write-path: none (suggestions are not stored).
read-path: Market → Topic groups → "Suggest groups" → POST /api/coach/remote/market/topic-groups/suggest →
readMarketInputs (caller's client, 90 days) + readTopicGroups → computeMarket → candidates (2+ calls, ungrouped) →
topicGroupCoach → parseSuggestions (only given labels, each once, 2+ per group) → editable cards.

### Accept a suggestion
write-path: Accept → POST /api/coach/remote/market/topic-groups { module, name, members, source } →
requireSalesCoachManager → members checked against candidates → insert market_topic_groups (service role, company-pinned).
read-path: Market recounts (MarketView version bump) → GET market → readTopicGroups → computeMarket(…, groups) →
topicGrouper → the topic shows under the group's name with every wording listed.

### Ungroup
write-path: Ungroup → DELETE /api/coach/remote/market/topic-groups?id= → insert market_topic_group_retirements.
read-path: readTopicGroups drops retired groups → Market recounts.
