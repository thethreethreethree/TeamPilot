---
tbc_version: 1
trigger: fix
started_at: 2026-07-31T14:40:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — verify:live guards that every SECURITY DEFINER fn pins search_path (search_path-injection defense)

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json.

## 2. Why (a real privilege-escalation class, converted to a CI guard)

A SECURITY DEFINER function runs with its OWNER's privileges. If it does not pin its OWN `search_path`, a
caller can prepend a schema they control so the elevated function resolves a MALICIOUS shadowed object (a
fake function/table) — a privilege-escalation vector. Supabase's own linter flags this, but the linter is a
manual dashboard tool, not CI. This build is the LIVE, CI-integrated version: a new definer function added
without `set search_path` fails the build.

Verified live before building (§0): 115 SECURITY DEFINER functions in `public`, 0 without a pinned
search_path. So the property is currently perfect — which is exactly when to lock it (the guard passes now
and catches the future regression). It complements INVARIANT 4 (client-callable DEFINER tenant-param fn) on
the OTHER definer-risk axis: INVARIANT 4 is reachability (who can call it); this is injection (what it
resolves once called).

## 3. Design

A verify:live check: 0 SECURITY DEFINER functions in `public` may lack a `search_path=%` entry in
`proconfig`. Fails loudly with the offending function names.

## 4. Hypothesis

- **H1:** predicate returns 0 unpinned live (guard passes); it distinguishes pinned (115) from unpinned, so a
  synthetic unpinned definer fn would be counted and FAIL. Detection-tested before shipping.

## 5. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-31T14:40:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding earned — I queried the live proconfig for all 115 definer fns before writing the guard, confirming 0 unpinned rather than assuming.", "how_this_build_will_embody_it": "Section 2 states the live count; the predicate is detection-tested." },
  { "id": "§0.1",   "read_at": "2026-07-31T14:40:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH; this-session read_at." },
  { "id": "§1.5.1", "read_at": "2026-07-31T14:40:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Four layers — a definer fn that resolves a malicious object is a foundation-layer escalation; the guard protects the base.", "how_this_build_will_embody_it": "The check asserts every elevated fn pins its resolution path." },
  { "id": "§1.5.2", "read_at": "2026-07-31T14:40:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK then search — I hypothesised the search_path axis (distinct from the anon-reachability one already found) then verified it live.", "how_this_build_will_embody_it": "Section 2 distinguishes it from INVARIANT 4." },
  { "id": "§5",     "read_at": "2026-07-31T14:40:00Z", "source_file": "CLAUDE.md", "line_range": "334-346", "why_it_governs": "Knowledge≠intelligence / distrust-the-easy-answer — this is a REAL escalation class (Supabase lints it), not a narrow guard invented to satisfy the build pressure; a security team would want it.", "how_this_build_will_embody_it": "The guard is the CI form of a recognised lint, not manufactured." },
  { "id": "§6",     "read_at": "2026-07-31T14:40:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — read-only guard, only fails-more; the why is a documented privilege-escalation vector.", "how_this_build_will_embody_it": "closure states the effect; only tightens." },
  { "id": "A19",    "read_at": "2026-07-31T14:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across all entries." },
  { "id": "A22",    "read_at": "2026-07-31T14:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "This manifest + the commit's Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-07-31T14:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "91-93", "why_it_governs": "A fix is not complete until the class is gated — the search_path-injection class is now gated live.", "how_this_build_will_embody_it": "verify:live fails on any unpinned definer fn; detection-tested." },
  { "id": "A38",    "read_at": "2026-07-31T14:40:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run.", "how_this_build_will_embody_it": "check.md pastes verify:live 22/22 + the detection-test + exit." }
]
```
