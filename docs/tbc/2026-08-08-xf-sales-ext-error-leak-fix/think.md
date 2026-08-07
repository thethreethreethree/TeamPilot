---
tbc_version: 1
trigger: fix
started_at: 2026-08-08T07:25:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 2
---

# THINK — Sales Coach extension: two audit findings (error-detail leak + false-empty summary)

(Build `xf` — post-9 daily builds sort after `x9` as xa..xf.)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH DOC_MANIFEST.json, recomputed this session
(`sha256sum`, both equal). Cited clauses re-read this session (see the session-read manifest, section 7 below).

## 2. How these were found (§1.5.2 proactive audit)
Not founder-reported. A ground-up, outside-view audit of the freshly-shipped, auth-bearing
coach/extension surface — dispatched because I had been asserting its correctness from a conversation summary
rather than fresh reads. Seven lenses; five clean; two real flags.

## 3. The two problems, understood from the record (§0)

**F1 — CWE-209 error-detail leak (med).** `llmErrorResponse.ts` returned `{ error: err.message, kind }` for
any `LlmError`. `err.message` is NOT generic: the provider layer builds it from raw upstream text
(`deepseek.ts:153` → `` `DeepSeek API error ${status}: ${rawBody.slice(0,200)}` ``; the missing-key path →
`"DEEPSEEK_API_KEY not set."`). So an entitled rep triggering a provider 400/500 received the AI vendor's
identity + up to 200 chars of upstream body. Compounding: the `LlmError` branch had NO server-side log (the
`console.error` only fired on the non-LlmError branch) — the real cause was sent to the client and dropped
from the operator's logs. WHY it matters here specifically: the product markets "C.A.R.E AI / ELOSTATE";
leaking "DeepSeek" to a customer undercuts that, and raw upstream bodies are classic CWE-209 disclosure.

The nuance that kept this from being a blunt "strip everything": `kind` (a safe enum — rate_limit/timeout/…)
is INTENTIONALLY surfaced (the client backs off on it; my own prior note records "authed LlmError kind is
intentional"). The leak is `err.message`, not `kind`. The fix must keep `kind`, drop `message`.

**F2 — false-empty summary (low).** `summarize/route.ts` returned `{ summary }` on a successful call even
when the model returned `""`. The route's OWN docstring says an empty summary "would dishonestly read as
'nothing to summarize' (§3.4)" — yet it didn't guard it, while copilot/formulate DO (`if (!reply) → 502`).
An honesty-thesis gap: a failure-shaped-as-empty.

## 4. Interconnection trace (§1.5) — the sibling that is NOT in scope
The identical `err.message` leak exists inline in FOUR C.A.R.E extension routes (they never adopted the shared
helper). Holistic honesty (§1.5) says name it; §5 + §1.5.2 ("not a license to refactor without explicit
need") say do NOT unilaterally rewrite the shipping C.A.R.E product under the continuation guard's pressure.
Resolution: fix the sales chokepoint (in scope, mine), and FLAG the C.A.R.E copies to the founder with the
one-line-each fix offered (closure §residuals). Guiding, not overtaking (§3.3).

## 5. Hypotheses (§1.5.2)
- **H1 (leak):** a provider error returns raw vendor text to the client. Confirm: a unit test feeding an
  LlmError whose message contains "DeepSeek"/"internal detail" asserts NEITHER string appears in the response
  body, the response uses the generic fallbackMessage, `kind` is preserved, and the real cause is logged.
  **Held** (test added; 5/5 in the file).
- **H2 (false-empty):** an empty model summary renders as a blank "caught up". Confirm: a route test with the
  engine mocked to `""` asserts 502 + no `summary` field. **Held** (added; route test 7→8).

## 6. Fix shape (§0 → solution only after understanding)
- `llmErrorResponse.ts`: log `kind`+`provider`+`status`+`message`+`rawBody` server-side; return
  `{ error: opts.fallbackMessage, kind: err.kind }` with the same status mapping. No raw message to the client.
- `summarize/route.ts`: `if (!summary) → 502` (mirrors copilot/formulate), logged.
- Tests updated: the old helper test LOCKED the leak (asserted `error === "slow down"`) — corrected to assert
  the generic message + a dedicated CWE-209 no-leak test; summarize route gains the empty-guard test.

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T07:34:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — audit + read the provider error construction before touching the mapping.", "how_this_build_will_embody_it": "Section 3 traces err.message to deepseek.ts before proposing the fix." },
  { "id": "§0.1", "read_at": "2026-08-08T07:34:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, hashes recomputed not cached.", "how_this_build_will_embody_it": "Section 1 records the sha256 MATCH recomputed this session." },
  { "id": "§1.5", "read_at": "2026-08-08T07:34:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — the same leak exists in 4 C.A.R.E routes; trace it, decide scope.", "how_this_build_will_embody_it": "Section 4: fix the sales chokepoint, flag the siblings rather than silently refactor." },
  { "id": "§1.5.1", "read_at": "2026-08-08T07:34:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer feature gate — L2 (does it actually work end-to-end) is the layer the error path lives in.", "how_this_build_will_embody_it": "The fix restores an honest L2 result on failure (real error, not a leak or a false-empty)." },
  { "id": "§1.5.2", "read_at": "2026-08-08T07:34:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit is what found these; and its 'no license to refactor without need' bounds the C.A.R.E scope.", "how_this_build_will_embody_it": "Audit-driven; C.A.R.E left as a founder-gated flag." },
  { "id": "§3.3", "read_at": "2026-08-08T07:34:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — the identical C.A.R.E leak is flagged for the founder, not silently rewritten.", "how_this_build_will_embody_it": "Section 4 + closure hold the C.A.R.E change for founder go-ahead." },
  { "id": "§3.4", "read_at": "2026-08-08T07:34:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — a failure must not be dressed as an empty result.", "how_this_build_will_embody_it": "F2 fix: empty summary → 502, not a blank success." },
  { "id": "§5", "read_at": "2026-08-08T07:34:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder under pressure — scope the fix honestly under the continuation guard; don't overreach into the shipping product.", "how_this_build_will_embody_it": "Section 4 holds the C.A.R.E change for founder judgment." },
  { "id": "§6", "read_at": "2026-08-08T07:34:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think walks the gap, the trace, the hypotheses, the scope call." },
  { "id": "A19", "read_at": "2026-08-08T07:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); the cited axioms were opened this build before citation." },
  { "id": "A22", "read_at": "2026-08-08T07:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T07:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate. The leak fix is locked by a regression test, not just a comment.", "how_this_build_will_embody_it": "The CWE-209 no-leak test fails on regression; closure names the un-gated residual (no invariant forces new routes through the helper)." },
  { "id": "A38", "read_at": "2026-08-08T07:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Checked' = the canonical command by name, with its exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check exit 0." }
]
```
