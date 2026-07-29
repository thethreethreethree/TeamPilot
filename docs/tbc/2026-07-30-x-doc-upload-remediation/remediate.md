# REMEDIATE — doc-upload audit findings

Every finding gets a disposition (FIXED | DECLINED). No finding left without one.

### F5 — extraction cap exceeds the field cap (MEDIUM)

disposition: FIXED — `MAX_EXTRACTED_CHARS` 500k → 100k, matching the corpus/product save + editor cap, so
the extracted text always fits and Save is never silently disabled.
closes: F5
clause: §1.5.1 layer 3 (workflow continuity restored)
gate-or-promise: gate — extractText test asserts `MAX_EXTRACTED_CHARS <= 100_000` AND a 300k doc extracts
to ≤ 100k; a future bump above the field cap fails the suite.
risk: a genuine >100k methodology is trimmed — but that already couldn't be saved (100k field cap), and
`truncated` now surfaces an honest "trimmed to fit" notice, which is strictly better than a disabled Save.

### F3 — advertised cap above the platform body limit (MEDIUM, A27)

disposition: FIXED — route `MAX_FILE_BYTES` 15MB → 4MB (under Vercel's ~4.5MB serverless body cap) + a
matching 4MB client-side pre-check in DocUploadButton.
closes: F3
clause: A27 (the invariant is now enforced below the label — the cap equals what the write path accepts)
gate-or-promise: promise — no clean gate for "the code cap ≤ the deploy's actual body limit" (the limit
is a platform/plan setting not visible to a unit test); filed to the residual for founder confirmation of
the exact deploy limit. The lowered cap + client pre-check are the structural fix.
risk: a legitimate >4MB document is now rejected — but such a doc could never complete the upload anyway
(platform-rejected), so this converts an opaque failure into a clear one; text docs are far under 4MB.

### F2 — entity double-decode (LOW)

disposition: FIXED — decodeEntities replaces `&amp;` LAST.
closes: F2
clause: A26 (correctness class)
gate-or-promise: gate — extractText test: `&amp;lt;` → `&lt;` (not `<`); recurrence fails it.
risk: none — the existing `&amp;`→`&` decoding still works (the `Ben &amp; Jerry` test passes).

### F1 — unbounded archive decompression / zip-bomb (MEDIUM-class / LOW-practical)

disposition: DECLINED (gate) — the decompression is real but there is NO precise gate: jszip exposes the
per-entry uncompressed size only on a private `_data` field, and `file.async` decompresses fully with no
public streaming byte cap. A pattern-matching detector would fire on every legitimate `.async` call.
closes: F1
clause: A33 (name the hole, decline the noisy gate)
gate-or-promise: declined — the hole: server-side archive decompression is unbounded above the input size.
Named here + in the residual. Partial structural bound: the F3 input cap (4MB) shrinks the max input, and
the manager-gate + Vercel memory/maxDuration make exploitation self-tenant + platform-killed (no cross-
tenant or persistent impact). Severity is LOW in practice for exactly these reasons.
risk: n/a (no code change).

### F4 — binary-as-text garbage (LOW)

disposition: DECLINED (gate) — "is this actually text?" has no precise detector without false positives
(a valid UTF-8 doc with unusual bytes would trip a heuristic).
closes: F4
clause: A33
gate-or-promise: declined — the mitigation is the manager REVIEW step: the extracted text fills the draft
and the manager reads it before Save, so garbage is caught by a human, not shipped to the prompt. Filed to
residual.
risk: n/a (no code change).
