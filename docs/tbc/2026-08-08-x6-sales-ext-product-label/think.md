---
tbc_version: 1
trigger: fix
started_at: 2026-08-08T04:55:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 14
hypotheses: 2
---

# THINK — Sales Coach Extension: product label in the entitlement 402

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

## 2. The defect (§1.2 / §3.4)
The sales extension routes reuse the shared `guardExtensionRequest` → `requireEntitledExtensionUser`, whose
402 message is hardcoded to "C.A.R.E extension" ("Your 14-day C.A.R.E extension trial has ended." /
"Your plan doesn't include the C.A.R.E extension."). A locked Sales Coach user would therefore be told about
a C.A.R.E trial — a message that names the wrong product the user is in. That is a §3.4 honesty defect: the
response says something the user's actual surface contradicts.

## 3. What is (and is NOT) in scope
IN: name the surface correctly in the 402 message. The entitlement SOURCE — whether the sales extension
SHARES the C.A.R.E entitlement or gets its own SKU/trial — is a FOUNDER PRICING DECISION (per the pricing/
entitlement work already flagged founder-gated) and is deliberately NOT decided here. The label fix is
correct under EITHER model, because it only names the caller's surface, not the entitlement's source.

## 4. Interconnection trace (§1.5) — ripple containment
`requireEntitledExtensionUser` + `guardExtensionRequest` are shared by 8 C.A.R.E routes. The fix adds an
OPTIONAL `productLabel` defaulting to "C.A.R.E extension", so every existing C.A.R.E caller is byte-for-byte
unchanged (verified: the C.A.R.E extension route tests + the auth test's default-branding case stay green).
Only the 4 sales routes opt in with "Sales Coach extension".

## 5. §3.4 honesty
A locked sales user now sees "Your 14-day Sales Coach extension trial has ended." — the product they are
actually using. The message no longer contains "C.A.R.E" for a sales caller (asserted by a test).

## 6. Hypotheses (§1.5.2)
- **H1 (C.A.R.E regression):** parameterizing the message could change the C.A.R.E text. Confirm: a
  no-label call returns the exact original string; tested + all C.A.R.E route tests green. **Held.**
- **H2 (sales branding):** the sales routes must not leak C.A.R.E branding. Confirm: the sales label produces
  the sales string and `not.toContain("C.A.R.E")`; tested. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T04:55:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — trace the shared gate to the message before changing it.", "how_this_build_will_embody_it": "Section 2 locates the hardcoded label in the shared gate the sales routes reuse." },
  { "id": "§0.1", "read_at": "2026-08-08T04:55:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.2", "read_at": "2026-08-08T04:55:00Z", "source_file": "CLAUDE.md", "line_range": "54-60", "why_it_governs": "Retrospective identification — the defect is read from the actual shared-gate code, not theorized.", "how_this_build_will_embody_it": "Section 2 traces the hardcoded C.A.R.E label the sales routes inherit." },
  { "id": "§3.3", "read_at": "2026-08-08T04:55:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — flag the founder entitlement-source decision rather than guessing it.", "how_this_build_will_embody_it": "Section 3 scopes the SOURCE decision OUT; closure RES-01 records it for the founder." },
  { "id": "§1.5", "read_at": "2026-08-08T04:55:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — the change touches shared auth used by 8 C.A.R.E routes; it must not regress them.", "how_this_build_will_embody_it": "Section 4: optional param, default preserves C.A.R.E exactly; verified by their tests." },
  { "id": "§1.5.1", "read_at": "2026-08-08T04:55:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L4 surface: the message a locked user reads must match their product.", "how_this_build_will_embody_it": "The 402 copy now names the caller's surface." },
  { "id": "§1.5.2", "read_at": "2026-08-08T04:55:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesize C.A.R.E-regression + sales-branding before changing shared code.", "how_this_build_will_embody_it": "Section 6 states H1/H2 with confirming tests." },
  { "id": "§3.4", "read_at": "2026-08-08T04:55:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — a response must not name a product the user isn't in.", "how_this_build_will_embody_it": "The label names the caller's actual surface; a test asserts no C.A.R.E leak for sales." },
  { "id": "§5", "read_at": "2026-08-08T04:55:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — don't guess the entitlement SOURCE to look complete; fix only what's decision-independent.", "how_this_build_will_embody_it": "Section 3 scopes OUT the founder pricing decision; only the label (correct under either model) is changed." },
  { "id": "§6", "read_at": "2026-08-08T04:55:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks the defect, the ripple containment, the honesty rationale, and the scoped-out decision." },
  { "id": "A19", "read_at": "2026-08-08T04:55:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A22", "read_at": "2026-08-08T04:55:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T04:55:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate.", "how_this_build_will_embody_it": "The default-preserves-C.A.R.E + sales-no-leak behaviors are both locked by tests, not comments." },
  { "id": "A38", "read_at": "2026-08-08T04:55:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit 0." }
]
```
