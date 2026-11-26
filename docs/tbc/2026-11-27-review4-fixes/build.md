# BUILD - Review 4 fixes

### Erasure of topic members
write-path: unchanged (rss_erase_topic_members).
read-path: every group (retired too); the erased calls' intel topics first; the other calls only while a candidate remains; payload->intel->topics only.

### Webhook claims
write-path: unchanged.
read-path: a claim error other than 23505 → 500 with claimErrors; stale-claim attempt text says it may have been sent.

### Extension matcher
write-path: none.
read-path: only /extension/connect is held for the code.
