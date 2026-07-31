---
tbc_version: 1
trigger: fix
started_at: 2026-07-31T14:20:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — verify:live guards the §3.5 durability-emit trigger (completes the §3-thesis trigger coverage)

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json.

## 2. Why (the deliberate follow-up to §3.4, now analyzed)

The §3.4 build's closure named §3.5 as the remaining thesis-trigger, "to be done deliberately" because its
enforcement looked like a cron+trigger mix. Doing that analysis (§0): the trigger
`resolutions_durability_review_trigger` runs `resolutions_emit_durability_review` — AFTER UPDATE OF durability
on `resolutions`, it INSERTS a `resolution.durability_reviewed` event whenever a resolution's durability
changes. So it is an EMIT trigger (records the §3.5 "did the fix hold?" moat metric into the immutable event
chain, §3.1+§3.6), not a raise trigger.

Its silent-removal failure mode is real and thesis-critical: if the trigger were dropped (a migration
recreating `resolutions` triggers), durability reviews would stop reaching the event chain — the §3.5 signal
and the §3.6 "make learning visible" evidence would vanish while the function still exists. Same
fn-checked-not-trigger class as §3.2 / H2 / H3 / §3.4; just an emit rather than a raise.

## 3. Design (grounded, §0)

Verified live: `resolutions_durability_review_trigger` on `resolutions` runs `resolutions_emit_durability_review`
firing on UPDATE (tgtype=17 = ROW+UPDATE, AFTER). The check asserts a non-internal trigger on `resolutions`
runs that fn firing on UPDATE (bit 16). This COMPLETES the §3-thesis trigger-wiring live-coverage:
§3.1 (append-only rules), §3.2 (gate), §3.4 (control-window), §3.5 (durability-emit).

## 4. Hypothesis

- **H1:** predicate returns 1 live (guard passes) and 0 for a wrong fn (would FAIL on a dropped durability
  trigger). Detection-tested before shipping.

## 5. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-31T14:20:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding earned — I read the durability trigger's fn body live to learn it's an EMIT (not raise) before writing the guard, correcting my prior 'less clear-cut' assumption.", "how_this_build_will_embody_it": "Section 2 states the emit semantics from the live fn; predicate detection-tested." },
  { "id": "§0.1",   "read_at": "2026-07-31T14:20:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH; this-session read_at." },
  { "id": "§1.5.1", "read_at": "2026-07-31T14:20:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Four layers — a guard checking the fn but not its trigger reports false health at the foundation.", "how_this_build_will_embody_it": "The check verifies the emit is WIRED, not merely present." },
  { "id": "§1.5.2", "read_at": "2026-07-31T14:20:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK then search — I analyzed the deferred trigger before building, not bundling it blindly.", "how_this_build_will_embody_it": "Section 2 is the promised deliberate analysis." },
  { "id": "§3.5",   "read_at": "2026-07-31T14:20:00Z", "source_file": "CLAUDE.md", "line_range": "294-307", "why_it_governs": "Measurement rules — durability (did the fix hold?) is the moat metric; the emit trigger makes it a visible immutable event.", "how_this_build_will_embody_it": "The guard fails if the durability-emit trigger is dropped." },
  { "id": "§6",     "read_at": "2026-07-31T14:20:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — traced the read-only blast radius + the why (the signal must keep reaching the chain).", "how_this_build_will_embody_it": "closure states the effect; the change only tightens." },
  { "id": "A19",    "read_at": "2026-07-31T14:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across all entries." },
  { "id": "A22",    "read_at": "2026-07-31T14:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "This manifest + the commit's Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-07-31T14:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "91-93", "why_it_governs": "A fix is not complete until the class is gated — this completes the §3-thesis trigger-wiring class.", "how_this_build_will_embody_it": "verify:live fails if the durability trigger is dropped; detection-tested." },
  { "id": "A38",    "read_at": "2026-07-31T14:20:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run.", "how_this_build_will_embody_it": "check.md pastes verify:live 21/21 + the detection-test + exit." }
]
```
