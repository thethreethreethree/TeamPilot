---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T12:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 16
hypotheses: 2
---

# THINK — the empty "Your read" is a GATE re-check bug, not starvation (account/company-based)

## 1. Document integrity — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) in-tree, hashes verified.

## 2. Why — diagnosed from the ACTUAL record (§1.2), not theory
Founder: "other users still get incomplete after-pitch; my admin account works." Then the decisive A/B:
SAME device, logged out of **Deeznuts** → into **Moses's admin** account → full after-pitch. So it is
account/company-based, not device/network/starvation.

Read-only prod retrospective (`scripts/diag-empty-reads.mjs`) over 102 recent after_pitch_summaries:
- `ai_guidance_enabled=false` companies: Deeznuts 13/13 empty, Align Sales Pros 8/8 + 6/6 + 1/1, Caliber 2/2 —
  **100% empty narrative**, and NONE of them have a corpus (so it is NOT corpus starvation).
- `ai_guidance_enabled=true` companies: Align Sales Pros 0/3 (no corpus, still works), ELOSTATE 45/68 works.
- ELOSTATE's 23/68 empties are the SEPARATE starvation case (11.7k-char methodology corpus) — the retry fix.

The discriminator is purely `ai_guidance_enabled`. That is the §3.4 control gate.

## 3. Root cause (the code, traced end-to-end)
Sales Coach engines all set `controlExempt: true`, and `runBrainCall` correctly honors it
(`brain/index.ts`: `if (!gate.guidanceEnabled && !args.controlExempt)` → it RUNS the LLM and returns the real
text with `gate.guidanceEnabled=false`). BUT the shared `call()` wrapper in `claude.ts` then re-checked
**only** `if (!r.gate.guidanceEnabled)` — the `controlExempt` term had drifted out of the duplicated
condition — and DISCARDED the real answer, returning `text:"" suppressed:true`. So on any guidance-off
company, every control-exempt engine (review/dissect/moments/live-cue/ask-coach) returned EMPTY **while still
burning the LLM call**. My earlier "it's starvation, not the control month" was WRONG for these companies —
the founder's control-gate instinct was right; the exemption was defeated one layer above the gate.

## 4. The fix (chokepoint)
`claude.ts` `call()` line ~50: `if (!r.gate.guidanceEnabled && !args.controlExempt)` — mirror runBrainCall's
own condition exactly. One line at the single wrapper every non-streaming engine shares, so it fixes review,
dissect, moments, live cues (the "0 cues" sessions), decision-dialogue, and ask-coach at once.

## 5. Interconnections traced (§1.5)
- Streaming path is SEPARATE and already correct: `runBrainStream` (index.ts) keeps the `&& !controlExempt`
  term, and the extension /suggest route doesn't re-check — so extension "Suggested Response" was never broken.
- The other `!gate.guidanceEnabled` re-checks (rippleTrace, outsideView, chat streams) are on NON-exempt
  Elostate engines (they never pass controlExempt), so their re-check is correct — NOT touched.
- §3.4 honesty preserved: the control window still holds for non-exempt callers (test 2). We are NOT
  mass-flipping company guidance flags to work around the bug — that would contaminate the control baseline;
  the code fix restores the INTENDED exemption instead.
- Durability: the bug was drift between two copies of one condition. Flagged follow-up — have runBrainCall
  return an explicit `suppressed` flag so no consumer re-derives the gate decision (remediate.md R1).

## 6. Hypotheses (§1.5.2)
- **H1 — is the empty read gated by `ai_guidance_enabled` (not starvation)?** YES — prod data: guidance=false
  → 100% empty, guidance=true → works, independent of corpus. Confirmed by the founder's same-device A/B.
- **H2 — after the fix, does a guidance-OFF company get the real text (not suppressed)?** YES —
  claude.controlExempt.test.ts: controlExempt + guidance off → suppressed:false + real text; non-exempt + off
  → still suppressed.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T12:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand precedes solving — diagnose the empty read from the record before patching.", "how_this_build_will_embody_it": "Pulled the actual prod distribution (diag script) + traced the code end-to-end before changing a line." },
  { "id": "§0.1", "read_at": "2026-08-14T12:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified." },
  { "id": "§1.2", "read_at": "2026-08-14T12:01:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — look backward at the actual record, not forward from theory.", "how_this_build_will_embody_it": "The diag over 102 real summaries is what overturned my wrong 'starvation' theory and found the gate discriminator." },
  { "id": "§2", "read_at": "2026-08-14T12:01:10Z", "source_file": "CLAUDE.md", "line_range": "196-210", "why_it_governs": "No error loops — the starvation fix didn't hold; retrying that misdiagnosis with more force is forbidden. Go back to the Understanding Gate and re-diagnose from the record.", "how_this_build_will_embody_it": "Stopped forcing the starvation theory, pulled the prod record, and re-identified the root as the gate re-check." },
  { "id": "§1.5.1", "read_at": "2026-08-14T12:01:15Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 operational effectivity — the read 'worked' in unit tests but returned empty end-to-end for real guidance-off accounts; the seam between the exemption flag and the gate re-check is where it broke.", "how_this_build_will_embody_it": "Traced the real caller path (guidance-off company) to the discard point rather than trusting the passing unit tests." },
  { "id": "§1.3", "read_at": "2026-08-14T12:01:20Z", "source_file": "CLAUDE.md", "line_range": "184-190", "why_it_governs": "Outside view — I was invested in my 'it's starvation' conclusion; the founder's objection was data.", "how_this_build_will_embody_it": "Treated the founder's 'account-based' instinct as evidence and re-diagnosed from the record." },
  { "id": "§1.5", "read_at": "2026-08-14T12:01:40Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — one wrapper feeds many engines; the streaming path + non-exempt re-checks must not be broken.", "how_this_build_will_embody_it": "Verified runBrainStream + diagnosis re-checks are correct and untouched; fix only the drifted term." },
  { "id": "§1.5.2", "read_at": "2026-08-14T12:02:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK then verify — hypothesised the gate, CONFIRMED with prod data + code trace + the founder A/B before fixing.", "how_this_build_will_embody_it": "H1/H2 both evidenced." },
  { "id": "§3.4", "read_at": "2026-08-14T12:02:30Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "The control window is §3.4; Sales Coach is the INTENDED exemption. The fix must restore the exemption WITHOUT weakening suppression for non-exempt callers.", "how_this_build_will_embody_it": "Test 2 pins that non-exempt + guidance-off still suppresses; no guidance flags were flipped to mask the bug." },
  { "id": "§5", "read_at": "2026-08-14T12:03:00Z", "source_file": "CLAUDE.md", "line_range": "300-320", "why_it_governs": "Knowledge ≠ intelligence — my confident, well-formed 'starvation' answer was wrong; distrust the fast fluent conclusion.", "how_this_build_will_embody_it": "Went back to the record when the fix didn't hold, instead of forcing the starvation theory harder (no error loop, §2)." },
  { "id": "§6", "read_at": "2026-08-14T12:03:30Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — am I repeating a failed approach? The starvation fix didn't hold → re-diagnose.", "how_this_build_will_embody_it": "Stopped, re-identified from the record; the identification (not the implementation) had been wrong." },
  { "id": "A19", "read_at": "2026-08-14T12:04:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read call(), runBrainCall, runBrainStream, and every guidanceEnabled re-check before editing." },
  { "id": "A22", "read_at": "2026-08-14T12:04:30Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendments read this session." },
  { "id": "A26", "read_at": "2026-08-14T12:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "Sweep the class — is the same drift anywhere else?", "how_this_build_will_embody_it": "Enumerated all 6 guidanceEnabled re-checks; only call() was exempt-carrying and wrong; the rest are correct for their non-exempt callers." },
  { "id": "A30", "read_at": "2026-08-14T12:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "claude.controlExempt.test.ts (3) locks exempt-passes / non-exempt-suppresses / guidance-on-works." },
  { "id": "A38", "read_at": "2026-08-14T12:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit code." }
]
```
