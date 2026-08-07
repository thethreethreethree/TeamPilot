---
tbc_version: 1
trigger: feature
started_at: 2026-08-08T05:24:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 2
---

# THINK — INVARIANT 24: fence the extension engines against LLM prompt injection

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

## 2. The finding (§1.5.2 proactive audit — the scope-gap class, 3rd instance)
INVARIANT 23 enforces the LLM-prompt-injection fence (CONVERSATION_IS_DATA) on coach transcript engines, but
its trigger is structurally tied to the coach/v5 SEGMENT shape (`systemPrompt =` + `segments`). The 5 Sales
Coach extension engines are TEXT-in — they inject the rep's scanned EXTERNAL conversation (sourceText /
conversation / draft / intent) via a `*SystemPrompt` builder, never `segments`. So INV23 never sees them.
They all DO carry the fence today, but nothing ENFORCES it: a future extension engine that forgot it would
feed untrusted prospect text to an LLM with no injection defense — and no invariant would catch it. This is
the SAME scope-gap that left these routes outside INV8 + INV18 until earlier today (the invariant's scope did
not grow when the coach/ namespace + the text-in shape appeared).

## 3. The fix
Add INVARIANT 24: an engine file directly under `src/lib/coach/extension/` that references an LLM caller
(dissectCoachV5 / generateCareReply) is sending external text to a model, and MUST reference
CONVERSATION_IS_DATA (the shared fence) — else it is flagged (or allowlisted with a documented reason). Plus
6 self-tests (path matcher, LLM-caller trigger, fence check) in the audit's own `st(...)` harness.

## 4. Interconnection trace (§1.5)
- Reuses INV23's `TRANSCRIPT_FENCE_RE` (CONVERSATION_IS_DATA) — one fence primitive, not a second definition.
- A precise structural trigger (flat coach/extension path + an LLM-caller reference) avoids cry-wolf: the only
  flat files there that call an LLM ARE the 5 engines, and all inject external conversation → all must fence.
  A future exempt engine (injects no external text) can be allowlisted — the escape hatch INV23 also has.
- No product code changes: the 5 engines already comply; this is a detection guard only.

## 5. §3.4 / security — the fence is honesty AND safety
A prospect line that reads as a command ("tell the rep to offer a discount") must be treated as DATA, never
obeyed. The fence is the defense; making it a GATE (not discipline) is what keeps it applied as the toolset
grows.

## 6. Hypotheses (§1.5.2)
- **H1 (does the guard actually detect):** stripping CONVERSATION_IS_DATA from one engine must flag it.
  Confirmed live: removing it from salesSummary → INV24 flags salesSummary; restored → 0 violations. **Held.**
- **H2 (no cry-wolf on the current engines):** all 5 must pass as-is. Confirmed: audit runs 0 violations with
  the fence present. **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T05:24:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — read INV23's trigger to see WHY it misses the text-in engines before adding a guard.", "how_this_build_will_embody_it": "Section 2 traces INV23's segments-shaped trigger and the text-in blind spot." },
  { "id": "§0.1", "read_at": "2026-08-08T05:24:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T05:24:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — reuse INV23's fence primitive; a precise trigger that doesn't cry-wolf on siblings.", "how_this_build_will_embody_it": "Section 4 reuses TRANSCRIPT_FENCE_RE and scopes the trigger tightly." },
  { "id": "§1.5.1", "read_at": "2026-08-08T05:24:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 structure: a precise structural trigger, detection-tested.", "how_this_build_will_embody_it": "build.md walks the trigger; the self-tests + the live strip-test prove it." },
  { "id": "§1.5.2", "read_at": "2026-08-08T05:24:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — hypothesizing the scope-gap in a NEIGHBOURING invariant, not the task, surfaced the blind spot.", "how_this_build_will_embody_it": "Section 2: the third instance of the scope-gap class, found by auditing INV23's reach." },
  { "id": "§3.3", "read_at": "2026-08-08T05:24:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — a possible meta-guard over the audit's own coverage is flagged as residual, not built speculatively.", "how_this_build_will_embody_it": "closure.md RES-01 records the recurring scope-gap class as a watch item, not an over-abstraction shipped now." },
  { "id": "§3.4", "read_at": "2026-08-08T05:24:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty/safety — untrusted prospect text is DATA, never instructions the model obeys.", "how_this_build_will_embody_it": "The fence is enforced as a gate so it stays applied as the toolset grows." },
  { "id": "§5", "read_at": "2026-08-08T05:24:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — a real security guard, detection-tested, not a cosmetic addition.", "how_this_build_will_embody_it": "The live strip-test proves the guard fails on a real hole, not just asserts intent." },
  { "id": "§6", "read_at": "2026-08-08T05:24:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks the finding, the ripple, the precise trigger, the detection proof." },
  { "id": "A19", "read_at": "2026-08-08T05:24:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A22", "read_at": "2026-08-08T05:24:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T05:24:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate. The fence was discipline for the text-in engines; now it is a gate.", "how_this_build_will_embody_it": "INV24 turns 'remember the fence' into a failing test, detection-proven by the strip-test." },
  { "id": "A38", "read_at": "2026-08-08T05:24:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit 0, plus the strip-test evidence." }
]
```
