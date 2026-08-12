# REMEDIATE — two §3.4 display-honesty fixes

## F1 — finance register re-hid truncation on a count-read failure
Root cause: `truncated = total > rows.length` with `total = rows.length` on a count failure → false → notice hidden.
Remediation: `total: number | null` (null on count failure); `truncated = pageFull && (total === null || total >
rows.length)`. Full page always discloses; exactly-1000 not truncated. UI renders "of N" when known, "there may be
older lines" when null. +2 route tests (count-failure / exactly-1000), mutation-checked.

## F2 — after-pitch header called an un-captured session a "conversation"
Root cause: the subtitle rendered "· {dur} conversation" whenever a duration existed, and for a no-audio session
`conversationDurationSeconds` returns the started..ended WALL-CLOCK (idle open-time), so an empty session read
"9m 9s conversation" over "No conversation was captured".
Remediation: render "· {dur} conversation" only when a conversation was CAPTURED — `session.audioDurationSeconds`
(real uploaded audio) OR `summary?.hasSignal` (a captured transcript). Otherwise fall to the context label. The
shared `conversationDurationSeconds` is untouched (its wall-clock is correct for a captured live call) — only the
LABEL is gated.

Boundary (A26): F1 — count-failure + exactly-1000 edges only. F2 — empty/no-capture header only; captured sessions
keep the label. F2 is React display (node-untestable); it gates an existing derived value, low-risk.

Outcome: both fixed. class: honesty-thesis display claims. severity: low (F1 edge) / medium (F2, founder-visible).
