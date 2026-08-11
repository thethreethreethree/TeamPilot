---
tbc_version: 1
trigger: fix
started_at: 2026-08-11T17:15:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 1
---

# THINK — Customer upload returns 502 (not a silent 200) when the attachment message fails to post

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes unchanged.

## 2. The defect (surfaced by the F2 port's adversarial review, 2026-08-11)
The independent adversarial review of the F2 port (build `2026-08-11-xf-care-upload-body-cap-port`) found a
PRE-EXISTING honesty asymmetry, now visible side-by-side in the two attach-tails extracted during F2:
- **Agent tail** (`agent-upload/route.ts` `attachAgentFile`): checks `postAgentMessage`'s result and returns
  **502** with the file row if it no-ops.
- **Customer tail** (`upload/route.ts` `attachCustomerFile`): ignored `postCustomerMessage`'s result and
  returned **200**.

So if the customer's inline attachment message fails to post (an RLS or write error — `postCustomerMessage`
returns `SupportMessage | null` and logs the cause), the customer reads "sent" while the **agent never sees the
file in the thread** (it only lands in the library filter). That is a §3.4 dishonest partial and the A16
apply-here-miss-there class — the correct behavior exists on the sibling tail and was not applied here.

## 3. The fix (§3.4 — never present a partial as a success)
Mirror the agent tail exactly: capture `postCustomerMessage`'s result; on `null`, return 502 with the file row
(recoverable) BEFORE emitting the asset event, so the widget — which already surfaces `!res.ok` — shows a retry
instead of false success. `postCustomerMessage` already logs the raw cause, so no CWE-209 concern.

## 4. Hypothesis (§1.5.2 think-first)
- **H1 — does 502 break the happy path or the widget?** → No: on a successful post (`posted` truthy) the flow
  is byte-identical to before (event emitted, 200 + file). The widget's existing `!res.ok` branch renders the
  502 error string; it does not call `onUploaded()` on error, so no false thread refresh. CONFIRMED (the
  happy-path test still returns 200 + records the real size/type; a new test locks the 502-on-null path).

## 5. Decision checklist (§6)
Understood (root cause is the ignored return value, read from the code + confirmed by an independent review);
precedent reused (mirrors the agent tail in the same file family); constraint real (an honest partial is
required, §3.4); holistic (only the customer tail changes; the agent tail already correct); gated by a test.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-11T17:15:30Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understanding precedes solving — the fix targets the read-the-return-value root cause, not a symptom.", "how_this_build_will_embody_it": "Root cause (ignored postCustomerMessage result) read from the code + confirmed by the F2 review." },
  { "id": "§0.1", "read_at": "2026-08-11T17:15:30Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Governing-doc hashes verified in-tree." },
  { "id": "§1.5.1", "read_at": "2026-08-11T17:16:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — don't fix one tail and leave the sibling inconsistent.", "how_this_build_will_embody_it": "Confirmed the agent tail already returns 502; only the customer tail needed the change; the two now match." },
  { "id": "§1.5.2", "read_at": "2026-08-11T17:16:15Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit — a review finding is a suspect to confirm, then fix.", "how_this_build_will_embody_it": "Confirmed the asymmetry by reading both tails before changing one." },
  { "id": "§3.4", "read_at": "2026-08-11T17:16:30Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty is the moat — never return 200 as if a partial were a full success.", "how_this_build_will_embody_it": "The customer tail now returns 502 with the file row when the attachment message did not post." },
  { "id": "§6", "read_at": "2026-08-11T17:16:45Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The decision checklist forces understanding + holistic before acting.", "how_this_build_will_embody_it": "Section 5 answers it; the fix is scoped to the one inconsistent tail." },
  { "id": "A16", "read_at": "2026-08-11T17:17:00Z", "source_file": "ThinkerThinker.md", "line_range": "40-52", "why_it_governs": "Apply-here-miss-there — a guard on one route must be applied to its sibling.", "how_this_build_will_embody_it": "The agent tail's post-check is now applied to the customer tail." },
  { "id": "A19", "read_at": "2026-08-11T17:15:45Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Methodology consulted from the working tree this session.", "how_this_build_will_embody_it": "Re-read both attach-tails in-tree before changing one." },
  { "id": "A22", "read_at": "2026-08-11T17:17:15Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A30", "read_at": "2026-08-11T17:17:30Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the class in a test.", "how_this_build_will_embody_it": "A test asserts 502 when postCustomerMessage returns null." },
  { "id": "A38", "read_at": "2026-08-11T17:17:45Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the canonical command + its output.", "how_this_build_will_embody_it": "check.md pastes the vitest + npm run check runs with exit codes." }
]
```
