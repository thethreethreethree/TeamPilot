# BUILD - Acting on the review of erasure, categories and the vocabulary re-apply

Migration 0369 (rss_erase_sessions: 0366's body + the per-call transcript lock). No env keys.

### An admin fixes past calls twice
write-path: reapply apply → applyCorrections leaves text that already says the term exactly as written → no change → no new version, no AI.
read-path: the count after a fix → 0 for calls already fixed.

### A batch is fixed
write-path: up to 5 calls → new versions → after(): their AI reads redone in parallel.
read-path: each call's notes on its new version.

### Erasure meets a concurrent re-apply
write-path: rss_erase_sessions takes each call's lock (0369) → a concurrent version write waits or finds its version gone.
read-path: no transcript version survives the erasure.
