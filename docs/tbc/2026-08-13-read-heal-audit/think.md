---
tbc_version: 1
trigger: audit
started_at: 2026-08-13T22:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 2
---

# THINK — read-starvation fix audit remediation (3rd adversarial agent)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why
"Audit the recent build fully" spawned a THIRD adversarial review agent on the read-starvation fix
(the DeepSeek token-headroom raise + the after-pitch auto-heal). The first two agents covered the
auto-update + the extension (shipped e828f0e9). This third agent audited the CORE incident fix — the
one the whole read-blank saga is about — and found the token-budget math sound + universally applied
at the provider, BUT the defense-in-depth layer (auto-heal) INERT for the exact incident it targets.
A finding is a SUSPECT (§1.2): I verified each against the code before fixing.

## 3. Findings kept (verified real) + the fix
- **F1 HIGH (after-pitch)** — the auto-heal (page.tsx) keyed on the COMPOSITE `hasSignal`
  (`narrative.hasSignal || moments || scores || cueLoop`, afterPitch.ts:160). The scores are
  DETERMINISTIC — `computeQuestionRate` returns a category for ANY session with agent turns — so a
  session whose "Your read" came back BLANK still stored `hasSignal:true` and the heal NEVER re-fired:
  the read stayed permanently blank while the composite claimed signal. This is the INV22
  "error-dressed-as-no-data" class surviving at the UI — the very thing the token fix exists to kill.
  It also means my "hard-refresh → the read fills in" guidance to the founder was WRONG for an
  already-stored blank read. Fix: key the heal on the NARRATIVE (`afterPitchNeedsHeal`, extracted +
  regression-locked). Targeted: scores-present ⟺ agent-turns-present, so blank-narrative-with-scores
  can only be a starved read; genuine-thin (no turns) has no scores → composite already false → first
  clause. Bounded once-per-mount by the existing ref.
- **F2 MEDIUM (deepseek stream)** — `parseSseDeltas` parsed `finish_reason` into its type but never
  READ it, so the "never silent again" `finish_reason:"length"` log existed only on the `call` path.
  A starved STREAMING engine (suggest/copilot/formulate/briefing) truncated silently — same class,
  different callers. Fix: track finish_reason across the stream + log at end-of-stream (EMPTY vs
  TRUNCATED), mirroring the call path. Three stream-path tests lock it.

## 4. Findings ACCEPTED (not a code fix)
- **F3 LOW** — the clamp `min((maxTokens ?? 900) + 7000, 8000)` fixes the MAX reasoning room at 8000
  (< the 8192 model limit, correctly). So raising `REASONING_HEADROOM_TOKENS` above ~7000 buys
  nothing, and a corpus ~3× the calibration re-starves. This is a real ceiling, but it is now
  OPS-VISIBLE on both paths (call + stream logs), and the real fix for scale is prompt/corpus-size
  reduction — a founder-gated decision (corpus-trim), NOT more headroom. No code change; flagged to
  the founder. The F1 fix makes any future re-starvation self-heal on the next view instead of
  sticking.

## 5. Hypotheses (§1.5.2)
- **H1 — does the F1 heal loop on genuinely-thin calls?** No. A genuinely-thin debrief has no agent
  turns → no deterministic scores → composite already false → the first clause (`!existing.hasSignal`)
  already handled it identically before. The new clause only adds the blank-narrative-WITH-scores
  case, which is exactly the starved case that SHOULD re-generate. CONFIRMED by the score derivation
  (salesScore computeQuestionRate: category iff repTurns.length > 0).
- **H2 — does the F2 log fire once, only on length, and not swallow content?** The generator still
  yields every content delta (sawContent tracks it); finish_reason is recorded per event; the log
  fires in `finally` only when finishReason === "length". CONFIRMED by the 3 stream tests (empty→log,
  truncated→log TRUNCATED, stop→no log).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-13T22:40:00Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand each finding from the record before fixing — a finding is a suspect.", "how_this_build_will_embody_it": "F1/F2 verified against the code (afterPitch.ts composite, parseSseDeltas) before the fix; F3 accepted with reasoning." },
  { "id": "§0.1", "read_at": "2026-08-13T22:40:10Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1)." },
  { "id": "§1.2", "read_at": "2026-08-13T22:40:20Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective/record-check: the agent finding is a SUSPECT — confirm against the code.", "how_this_build_will_embody_it": "Read afterPitch.ts:160 (composite) + page.tsx:286 (heal) + deepseek.ts parseSseDeltas before fixing." },
  { "id": "§1.5.1", "read_at": "2026-08-13T22:40:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 operational effectivity: the feature (the read) technically 'had signal' but did not actually deliver the read — the four-layer sieve fails at layer 2, not layer 4.", "how_this_build_will_embody_it": "The fix restores the actual end-to-end result (a real read appears), not just a 200/has-signal." },
  { "id": "§2", "read_at": "2026-08-13T22:40:40Z", "source_file": "CLAUDE.md", "line_range": "52-75", "why_it_governs": "Diagnose before patching; explain the WHY.", "how_this_build_will_embody_it": "Root cause = composite masks the narrative (not 'raise the budget more'); the fix targets the mask." },
  { "id": "§1.5.2", "read_at": "2026-08-13T22:40:35Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive THINK-then-search: the third agent + H1/H2 confirm against code — quality over quantity.", "how_this_build_will_embody_it": "Two real fixes + one reasoned acceptance; regression tests added for both fixes." },
  { "id": "§6", "read_at": "2026-08-13T22:40:42Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (both paths, the composite consumers) before shipping.", "how_this_build_will_embody_it": "F1 traced to the once-per-mount ref + the composite's other consumers; F2 keeps the content stream intact." },
  { "id": "A30", "read_at": "2026-08-13T22:40:52Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate safety properties with tests where testable.", "how_this_build_will_embody_it": "afterPitchNeedsHeal + the 3 stream-log tests are pure/node-testable and detection-tested." },
  { "id": "A19", "read_at": "2026-08-13T22:40:50Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read the after-pitch page effect + afterPitch.ts + deepseek.ts before editing." },
  { "id": "A22", "read_at": "2026-08-13T22:40:55Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this remediation's reads; minimum set present." },
  { "id": "A38", "read_at": "2026-08-13T22:41:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
