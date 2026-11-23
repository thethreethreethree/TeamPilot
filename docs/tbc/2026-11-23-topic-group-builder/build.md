# BUILD - Make and edit topic groups by hand

No migration. No env keys.

### Make a group
write-path: Market → Topic groups → "Make a group" → name + ticked topics → "Save group" → POST
/api/coach/remote/market/topic-groups { module, name, members, source: "manager" } → existing checks → insert.
read-path: GET topic-groups?candidates=1&module= → readMarketInputs + readTopicGroups → candidates() → the form's list.

### Edit a group
write-path: "Edit" → form opens with the group's topics ticked (matched by topicKey) → "Save group" → POST with
replaces → new group + retirement of the old.
read-path: GET topic-groups?candidates=1&editing=<id> → candidates including the edited group's own topics.
