# REMEDIATE — page the message reads past the 1000-row cap

## F1 — route both message reads through fetchAllPaged
Remediation: `fetchMessages` (chats.ts) and `listCareMessagesForCustomer` (care.ts) now read via `fetchAllPaged`,
which pages `.range` windows past PostgREST's 1000-row cap and throws honestly on error. A secondary
`.order("id")` keeps range paging deterministic across a `created_at` tie at a page boundary. Behavior-preserving:
the caller still receives the WHOLE thread, so a busy channel is no longer frozen in the past and the AI reads
current context. The INV22/§3.4 "never swallow a read error as an empty thread" guard is retained via
fetchAllPaged's throw (chats: surfaced to the page's honest error state; care: turned into a 500 by the widget
route so the chat keeps its prior messages).
gate: `chats.pagination.test.ts` (returns all 1005, newest present — a reverted unbounded read caps at 1000 and
fails) + the retained throw-on-error tests. class: silent-truncation / correctness. severity: high. Fixed.

## Design note
Founder chose the behavior-preserving `fetchAllPaged` fix (unblocks the correctness bug today) over the larger
recent-N + load-older UX build — which remains a later performance optimization for very large threads.
