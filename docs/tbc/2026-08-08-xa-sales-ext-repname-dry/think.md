---
tbc_version: 1
trigger: refactor
started_at: 2026-08-08T05:34:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 14
hypotheses: 1
---

# THINK — DRY the rep-name lookup across the 5 sales extension routes

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…, 429) + ThinkerThinker.md (0428…, 1039) MATCH DOC_MANIFEST.json, re-verified this
session. Cited clauses re-read this session (manifest in section 7).

## 2. The finding (simplify/reuse — my own session's diff)
Reviewing the code I built this session (the `/simplify` reuse lens, applied to my own output — verifiable,
can't yield a false finding), the best-effort rep-name lookup — resolve the signed-in rep's `full_name` for
the WHO-IS-WHO anchor, degrade to "the sales rep" on any miss — is duplicated VERBATIM in all 5 sales tool
routes (dissect/coach/summarize/copilot/formulate): ~12 lines × 5. That is the "special case copied onto
shared infra" smell — extract it.

## 3. The change
`resolveRepName(userId)` in `src/lib/coach/extension/repName.ts`; each route replaces its inline block with
`const repName = await resolveRepName(user.userId);` and drops the now-unused `createAdminClient` import. One
mechanism (§A21), ~55 duplicated lines removed, behavior identical.

## 4. Interconnection trace (§1.5) — behavior preserved
The helper does exactly what the inline block did (same query, same trim, same generic fallback, same
never-throw). The 5 route tests already mock `createAdminClient` at `@/lib/supabase/admin`; the helper imports
from the same path, so the mock still intercepts it and the "repName threaded to the engine" assertions still
hold. No route's external behavior changes.

## 5. Not a fabrication risk
Best-effort by design: a failed lookup or a nameless profile returns the generic label, and the WHO-IS-WHO
anchor is a no-op with the generic name — never a fabricated identity (§3.4 unchanged from before).

## 6. Hypothesis (§1.5.2)
- **H1 (behavior drift):** the extraction could subtly change what the routes send. Confirm: the helper is a
  line-for-line move; the 5 route tests + a new 5-case helper test pass; tsc clean (no unused import). **Held.**

## 7. Session-read manifest (A22)
```json
[
  { "id": "§0", "read_at": "2026-08-08T05:34:00Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand before solving — confirm the 5 blocks are identical before extracting.", "how_this_build_will_embody_it": "Section 2 verified the verbatim duplication across all 5 routes first." },
  { "id": "§0.1", "read_at": "2026-08-08T05:34:00Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Precondition gate — methodology in the tree, re-read not cached.", "how_this_build_will_embody_it": "Section 1 records the hash MATCH re-verified this session." },
  { "id": "§1.5", "read_at": "2026-08-08T05:34:00Z", "source_file": "CLAUDE.md", "line_range": "78-96", "why_it_governs": "Holistic — a refactor touching 5 routes must not change their behavior.", "how_this_build_will_embody_it": "Section 4: line-for-line move; the route tests' mock still intercepts the helper." },
  { "id": "§1.5.1", "read_at": "2026-08-08T05:34:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Four-layer gate — L1 structure: one helper, five thin call sites.", "how_this_build_will_embody_it": "build.md shows the extraction; the helper is unit-tested." },
  { "id": "§1.5.2", "read_at": "2026-08-08T05:34:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — reviewing my OWN diff for reuse, not hunting elsewhere for bugs.", "how_this_build_will_embody_it": "Section 2 applies the simplify/reuse lens to this session's output." },
  { "id": "§3.3", "read_at": "2026-08-08T05:34:00Z", "source_file": "CLAUDE.md", "line_range": "270-281", "why_it_governs": "Guide, don't overtake — the C.A.R.E-side DRY is flagged as a follow-up, not forced onto working code now.", "how_this_build_will_embody_it": "closure.md RES-01 records the C.A.R.E agentName adoption as optional, not built here." },
  { "id": "§3.4", "read_at": "2026-08-08T05:34:00Z", "source_file": "CLAUDE.md", "line_range": "282-293", "why_it_governs": "Honesty is the moat — the best-effort fallback must not fabricate an identity.", "how_this_build_will_embody_it": "The helper returns the generic label on any miss; the anchor is a no-op with it, never a fabricated name." },
  { "id": "§5", "read_at": "2026-08-08T05:34:00Z", "source_file": "CLAUDE.md", "line_range": "334-351", "why_it_governs": "Builder-under-pressure — prefer a verifiable refactor (can't produce a false finding) over undirected bug-hunting under the guard's pressure.", "how_this_build_will_embody_it": "A behavior-preserving DRY extraction, tested, not a speculative bug hunt." },
  { "id": "§6", "read_at": "2026-08-08T05:34:00Z", "source_file": "CLAUDE.md", "line_range": "352-380", "why_it_governs": "Decision checklist before acting.", "how_this_build_will_embody_it": "think.md walks the duplication, the behavior-preservation, the test evidence." },
  { "id": "A19", "read_at": "2026-08-08T05:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-527", "why_it_governs": "Methodology in the working tree, consulted not cached.", "how_this_build_will_embody_it": "TT.md present (hash MATCH); axioms re-read before citation." },
  { "id": "A21", "read_at": "2026-08-08T05:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "528-591", "why_it_governs": "One mechanism, not a fork — five copies of a lookup is the anti-pattern; extract to one.", "how_this_build_will_embody_it": "resolveRepName is the single implementation the 5 routes call." },
  { "id": "A22", "read_at": "2026-08-08T05:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-767", "why_it_governs": "Citations require session-reading.", "how_this_build_will_embody_it": "This manifest pairs each cited id with a read timestamp + line range." },
  { "id": "A30", "read_at": "2026-08-08T05:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-790", "why_it_governs": "A lesson in prose returns — encode it in a gate. The helper's fallback contract is now test-locked.", "how_this_build_will_embody_it": "The 5-case helper test locks the trim + generic-fallback + never-throw behavior." },
  { "id": "A38", "read_at": "2026-08-08T05:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1038", "why_it_governs": "'Verified' = the canonical command by name, with exit code.", "how_this_build_will_embody_it": "check.md pastes npm run check coverage + exit 0." }
]
```
