---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T02:48:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 9
hypotheses: 1
---

# THINK — connect handoff: guard the ID-SOURCE half of the product-parameterization

(Build `xj` — post-9 daily builds sort after `x9` as xa..xj.)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) recomputed this session, unchanged. Cited axioms re-read this
session during the preceding xg/xh/xi builds (same continuous session); methodology in the tree (A19), cited
from content (A22).

## 2. The gap, understood from the record (§0)
This session I traced the connect handoff (`src/app/extension/connect/page.tsx`) and confirmed its security is
correct: `isExtensionHandoffAllowed` pins the token hand-off to the configured extension id, and the page is
product-parameterized — `sales` picks `sales-connect` + `NEXT_PUBLIC_SALES_EXTENSION_ID`, default picks the
C.A.R.E pair. `extensionHandoff.test.ts` locks the predicate; and `salesExtensionClientWiring.test.ts` already
guards the MESSAGE-TYPE half (sales-connect vs care-connect, product=sales).

But the pinning is only as safe as the id it pins TO, and the ID-SOURCE half of the parameterization —
`allowedExtId = sales ? process.env.NEXT_PUBLIC_SALES_EXTENSION_ID : process.env.NEXT_PUBLIC_CARE_EXTENSION_ID`
— is UNGUARDED. A refactor that crossed that ternary (pinned sales to the C.A.R.E env, or vice-versa) would
pin a sales sign-in's session + refresh token to the WRONG extension — a silent auth-misdirection with a
security flavor — and no test would catch it. The message-type guard next to it would still pass.

## 3. The guard (§1.5.2 proactive + A30 gate-the-class)
Add one assertion to the existing "connect handoff" describe block: the connect page source contains the exact
branch ordering `sales ? …SALES_EXTENSION_ID : …CARE_EXTENSION_ID` (regex, so a swap fails). Completes the
parameterization coverage — message-type guarded + id-source guarded — so neither half can silently cross.

## 4. Interconnection trace (holistic)
- Test-only; the connect page (shared C.A.R.E + sales) is NOT modified — this only reads its source, so no live
  product change and no builder-under-pressure exposure.
- Source-substring form matches the file's existing connect-handoff guards (the page is a client component;
  runtime-unverifiable in the node test env). Same posture as the sibling assertions in the block.
- Detection: the connect page contains the guarded ternary exactly once (grep = 1); the regex pins the ordering,
  so a crossed branch fails — a real detection guard, not a presence check that any ternary would satisfy.

## 5. Hypothesis (§1.5.2)
- **H1:** the guard passes on the current (correct) page and would fail a crossed ternary. Confirm: run it
  (48 pass, +1) and verify the exact ordered pattern exists in the page source (grep = 1); the regex requires
  SALES in the `sales ?` branch and CARE in the `:` branch, so a swap breaks it. **Held.**

## 6. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T02:52:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — trace the handoff's two parameterized halves before guarding.", "how_this_build_will_embody_it": "Section 2 identifies the unguarded id-source half after reading the page." },
  { "id": "§0.1", "read_at": "2026-08-08T02:52:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, hashes recomputed.", "how_this_build_will_embody_it": "Section 1 records the sha256 MATCH." },
  { "id": "§1.5.1", "read_at": "2026-08-08T02:53:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer L1 (structure): a security-relevant parameterization must be structurally guarded.", "how_this_build_will_embody_it": "The guard makes the id-source branch a CI check." },
  { "id": "§1.5.2", "read_at": "2026-08-08T02:53:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit — convert the verified parameterization into a guard.", "how_this_build_will_embody_it": "Follow-up to reading-and-confirming the handoff pins correctly today." },
  { "id": "§6", "read_at": "2026-08-08T02:54:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist — gate vs promise.", "how_this_build_will_embody_it": "A gate, detection-checked." },
  { "id": "A19", "read_at": "2026-08-08T02:57:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-476", "why_it_governs": "Methodology in the tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms opened this session." },
  { "id": "A22", "read_at": "2026-08-08T02:56:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-621", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a real read timestamp." },
  { "id": "A30", "read_at": "2026-08-08T02:55:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-789", "why_it_governs": "The governing axiom — encode the class in a gate; the message-type was gated, the id-source was only prose.", "how_this_build_will_embody_it": "The id-source parameterization becomes a CI gate that fails on a crossed branch." },
  { "id": "A38", "read_at": "2026-08-08T02:50:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1020", "why_it_governs": "'Verified' = the canonical command by name, with its output.", "how_this_build_will_embody_it": "check.md pastes `npm run check` + exit code." }
]
```
