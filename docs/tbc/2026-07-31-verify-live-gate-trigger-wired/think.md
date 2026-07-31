---
tbc_version: 1
trigger: fix
started_at: 2026-07-31T11:45:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — verify:live §3.2 check must assert the gate TRIGGER is wired, not just the fn

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json.

## 2. Why (a blind spot in a thesis-critical guard)

This session I empirically verified the §3.2 Understanding Gate is effective live: an INSERT of a
problem straight to status='open' with 0 signals RAISED "needs >=3, has 0". While reading the guard
that is supposed to protect this (`verify:live`), I found its §3.2 check asserts only that the gate
FUNCTION exists and contains `raise exception`, plus that the `'*'` threshold row is present. It does
NOT assert the TRIGGER is attached to `problems`.

That is a real blind spot: a migration that dropped the `problems_understanding_gate` trigger (or
narrowed it to UPDATE-only) would leave the gate silently un-fired — a direct INSERT of a non-'draft'
problem would BYPASS §3.2 entirely — while this check stayed green. The §3.2 gate is the constitutional
structural interrupt (a half-understood problem must not reach a human); a guard that reports it healthy
while it is un-wired is worse than no guard.

## 3. Design

Extend the existing §3.2 check to AND in a trigger-attachment assertion: a non-internal trigger on
`problems` whose function is `check_understanding_gate`, firing BEFORE, on BOTH INSERT and UPDATE
(pg_trigger tgtype bits: 2=BEFORE, 4=INSERT, 16=UPDATE). This mirrors the "check the effect, not just
the text" discipline that the INVARIANT-4 miss taught (a rule/fn present in migration text but not
effective live is the recurring class).

## 4. Hypothesis

- **H1:** The trigger-wired query returns 1 against the live DB (the trigger IS wired, so the check keeps
  passing), and returns 0 if any required bit (INSERT/UPDATE) is absent or the fn name is wrong (so it
  would FAIL on the bypass scenario). Detection-tested before shipping.

## 5. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-31T11:45:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding first — I empirically confirmed the gate fires (INSERT raised needs>=3) AND read the guard's own query before concluding it had a blind spot, rather than assuming.", "how_this_build_will_embody_it": "The fix is grounded in the live trigger definition (BEFORE INSERT OR UPDATE), detection-tested." },
  { "id": "§0.1",   "read_at": "2026-07-31T11:45:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH; this-session read_at." },
  { "id": "§1.5.1", "read_at": "2026-07-31T11:45:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Four layers — a guard's value is its structure (layer 1): a check that verifies the fn but not its wiring reports false health.", "how_this_build_will_embody_it": "The check now verifies the enforcement is WIRED, not merely present." },
  { "id": "§1.5.2", "read_at": "2026-07-31T11:45:00Z", "source_file": "CLAUDE.md", "line_range": "139-160", "why_it_governs": "THINK then search — I hypothesised the fn-exists check might not cover trigger attachment, then read the check + the live trigger to confirm.", "how_this_build_will_embody_it": "Section 2 records the blind spot from the actual guard source." },
  { "id": "§3.2",   "read_at": "2026-07-31T11:45:00Z", "source_file": "CLAUDE.md", "line_range": "265-274", "why_it_governs": "The understanding gate is structural, not optional — a guard that reports it healthy while the trigger is un-wired defeats the constitutional interrupt.", "how_this_build_will_embody_it": "The check asserts the trigger runs the gate fn BEFORE INSERT OR UPDATE on problems." },
  { "id": "§6",     "read_at": "2026-07-31T11:45:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — traced the blast radius (verify:live is a CI/manual gate; a stronger check can only fail-more, never mask) + explained the why (thesis-critical wiring).", "how_this_build_will_embody_it": "closure states the effect; the change only tightens, never loosens." },
  { "id": "A19",    "read_at": "2026-07-31T11:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across all entries." },
  { "id": "A22",    "read_at": "2026-07-31T11:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "This manifest + the commit's inline Session-Reads trailer." },
  { "id": "A30",    "read_at": "2026-07-31T11:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "91-93", "why_it_governs": "A fix is not complete until the class is gated — here the 'fix' IS strengthening the gate so the §3.2-un-wired class fails the build.", "how_this_build_will_embody_it": "The check now fails if the trigger is dropped/narrowed; detection-tested." },
  { "id": "A38",    "read_at": "2026-07-31T11:45:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run — the detection test output + exit are pasted.", "how_this_build_will_embody_it": "check.md pastes the verify:live 18/18 output + the detection-test result." }
]
```
