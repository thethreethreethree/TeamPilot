---
tbc_version: 1
trigger: fix
started_at: 2026-07-31T13:15:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — verify:live guard: every public view is security_invoker (the LIVE complement + the fix for my own false positive)

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json.

## 2. Why (born from an error I made this session — §5)

Earlier this session I raised a FALSE "HIGH: 14 finance views bypass RLS" finding and propagated it to the
founder queue. Root cause (§0 failure): I read `pg_class.reloptions` and tested it `== 'security_invoker=true'`
— but Postgres stores the boolean as **`on`**, so my check mis-classified invoker-safe views as unsafe, and I
misattributed the anon-returns-0 result to "empty tables" when it was RLS working. `rls:audit` (which parses
the migrations, correctly declaring `security_invoker = true`) reported **0 bypassing views** the whole time —
I overrode a correct guard with a buggy ad-hoc check.

Two structural gaps enabled this: (a) there was NO live guard for view-level RLS — rls:audit checks migration
TEXT, which stays green even if live DRIFTS (a `create or replace view` that omits the clause resets it to
owner-security); (b) the correct predicate was never codified, so an ad-hoc check re-derived it wrong.

## 3. Design

A verify:live check: **0 public views may lack `security_invoker`** (predicate matches BOTH `on` and `true`).
- LIVE (catalog), so it catches a drift the migration-text parse misses.
- Correct predicate codified, so my bug can't recur.
- Allowlist-free: verified 0 offenders live (every public view is invoker-safe).
- Fails loudly if a real bypass ever appears (a view running as owner over tenant tables).

Behavioral cross-check (the lesson [[reference_behavioral_verify_beats_catalog_string]]): `SET LOCAL ROLE
anon; SELECT count(*)` on the fin_ views returns 0 (RLS scopes anon) — the definitive proof the views are
safe, which the catalog predicate now encodes for CI.

## 4. Hypothesis

- **H1:** The predicate returns 0 offenders live (guard passes), correctly does NOT flag `security_invoker=on`
  or `=true`, and DOES flag a missing option (and a `security_barrier`-only view). Detection-tested before
  shipping.

## 5. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-31T13:15:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding must be EARNED — I raised a false finding by trusting a fast catalog-string match; this guard encodes the behaviorally-verified truth so understanding is structural, not re-derived wrong.", "how_this_build_will_embody_it": "The predicate matches on|true + is cross-checked by SET ROLE anon; the guard fails on a real drift." },
  { "id": "§0.1",   "read_at": "2026-07-31T13:15:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH; this-session read_at." },
  { "id": "§1.5.1", "read_at": "2026-07-31T13:15:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Four layers — a guard that mis-reads the catalog (layer 1) reports false health; the fix is the correct live predicate.", "how_this_build_will_embody_it": "Predicate detection-tested both directions." },
  { "id": "§1.5.2", "read_at": "2026-07-31T13:15:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK then search — I queried the correct predicate live (0 offenders) before writing the guard, rather than re-trusting the broken one.", "how_this_build_will_embody_it": "Section 2 records the root cause; section 3 is grounded in the corrected live count." },
  { "id": "§5",     "read_at": "2026-07-31T13:15:00Z", "source_file": "CLAUDE.md", "line_range": "334-346", "why_it_governs": "The builder under pressure + distrust the confident answer — my false finding was exactly the confident-too-quick trap; a project guard (rls:audit) that disagreed was the data I should have heeded.", "how_this_build_will_embody_it": "This build turns the corrected verification into a standing guard so the fast-wrong path is closed." },
  { "id": "§6",     "read_at": "2026-07-31T13:15:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — traced the blast radius (a read-only guard that only fails-more) + the why (live-drift the text parse misses).", "how_this_build_will_embody_it": "closure states the effect; the change only tightens." },
  { "id": "A19",    "read_at": "2026-07-31T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across all entries." },
  { "id": "A22",    "read_at": "2026-07-31T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "This manifest + the commit's inline Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-07-31T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "91-93", "why_it_governs": "A fix is not complete until the class is gated — the 'class' here is BOTH a real view-RLS drift AND my own re-derive-it-wrong failure mode; the guard gates both.", "how_this_build_will_embody_it": "verify:live fails on a non-invoker view; the correct predicate is codified." },
  { "id": "A38",    "read_at": "2026-07-31T13:15:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run — the detection test + verify:live output are pasted.", "how_this_build_will_embody_it": "check.md pastes the verify:live 19/19 + the predicate detection-test output + exit." }
]
```
