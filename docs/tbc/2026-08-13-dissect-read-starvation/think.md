---
tbc_version: 1
trigger: fix
started_at: 2026-08-13T13:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 2
---

# THINK — the after-pitch "Your read" goes blank on a real call (reasoning-model starvation on a large prompt)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (founder + sales-agent feedback 2026-08-13, screenshot)
On a real 4–5 min call the SCORES generated (Talk/Listen 71/29, Questions 9/11 — computed, not LLM) but the
"Your read" showed the short-call fallback ("short exchange… no full written read"). Diagnosis by the record, not
theory:
- `!narrative.hasSignal` triggers that fallback; `hasSignal` is true only when the dissect produced strengths
  (salesDissect.ts:215). So the dissect LLM returned EMPTY/no-strengths for a substantial call.
- The after-pitch page AUTO-HEALS — it re-runs the dissect when the stored read has no signal (page.tsx:281–288).
  It already retried and STILL came back empty → the failure is PERSISTENT, not a transient blip.
- Persistent + empty + a reasoning model = the DOCUMENTED starvation class (the code itself logs it, deepseek.ts):
  the deepseek reasoning model emits reasoning tokens BEFORE the answer and they COUNT against max_tokens; on a
  prompt LARGER than the ~9k-token calibration (a first-client's bigger custom methodology corpus + product
  knowledge + the full transcript), reasoning scales past the 3500 headroom → the answer budget is starved →
  empty content → no strengths → the fallback. The reasoning headroom was calibrated at ~2620 on a 9k prompt;
  a bigger corpus blows past it.

## 3. The fix (raise the headroom, but SAFELY bounded)
- `REASONING_HEADROOM_TOKENS` 3500 → 7000: covers a prompt ~2.6× the calibration. It is a CEILING (costs nothing
  on calls that finish naturally; only rescues starved ones).
- `MAX_TOTAL_TOKENS = 8000` clamp in `withReasoningHeadroom`: the raised headroom + a big answer budget (dissect
  1100, review 1500) would otherwise send max_tokens 8100/8500 and could EXCEED the model's 8192 output limit and
  400 EVERY deepseek call (there is no Anthropic failover in prod). The clamp bounds the total to 8000 — safely
  under 8192, and above the confirmed-working 5000 — so the big engines get ~6900/6500 reasoning room and no
  engine can blow the ceiling. Locked by a new unit test.
- Diagnostic (deepseek.ts): the "length"-finish log now fires on BOTH shapes (empty AND truncated answer) and
  prints prompt_tokens + completion_tokens + budget — so if 7000 is STILL insufficient for an extreme corpus, the
  next log says exactly how much reasoning the real prompt needs (and that the fix then is corpus trimming, since
  8192 is the model hard ceiling, not more budget).
- §3.4 honesty (after-pitch): the fallback no longer FALSELY asserts "This was a short exchange" for a 4–5 min
  call — it says the full read "isn't ready yet" and notes a genuinely-short exchange as one possibility.

## 4. Risk analysis (§1.5.1 — this touches EVERY deepseek engine)
The headroom + clamp apply to all deepseek calls. Risk: the clamp value (8000) exceeding the model's real max →
400 all calls. Mitigation: 8192 is the deepseek-v4 output limit; the confirmed-working total was 5000, so the
model max is ≥5000 and (standard sizing) 8192, making 8000 safe with margin. Tiny live engines (voice 80, cue 160)
are far below the clamp and unaffected. CI can't exercise the live API, so the clamp + the model-limit reasoning is
the guard, plus the enhanced log surfaces a 400 immediately if the assumption is ever wrong (recoverable by
reverting one constant).

## 5. Hypotheses (§1.5.2)
- **H1 — is the starvation the cause (vs a provider outage)?** The computed scores generated + only the LLM read
  is empty + auto-heal-retried-and-failed = persistent LLM-content-empty, the starvation signature; a provider
  outage would fail the OTHER LLM engines too and be transient. The enhanced log CONFIRMS on the next occurrence
  (finish_reason:length + completion_tokens). HIGH confidence, log-confirmable.
- **H2 — is the clamp safe + test-locked?** Yes: the total is `min(answer+7000, 8000)` ≤ 8000 ≤ 8192; the small-
  budget test cases (16, 900, 160) stay below the clamp and keep the full headroom; the big ones (1100, 1500,
  9999) clamp to 8000. CONFIRMED — 7 deepseek provider tests pass incl. the new clamp test.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-13T13:00:20Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Diagnose the blank read from the record (hasSignal gate, auto-heal, the starvation log) before changing the token budget.", "how_this_build_will_embody_it": "Section 2 traces hasSignal → dissect-empty → auto-heal-failed → starvation." },
  { "id": "§0.1", "read_at": "2026-08-13T13:00:20Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-13T13:00:40Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective — the code + the 2026-07-30 outage record + the auto-heal-failed evidence, not a forward guess.", "how_this_build_will_embody_it": "Section 2 grounds the diagnosis in the logged failure mode + the persistent-retry evidence." },
  { "id": "§1.5.1", "read_at": "2026-08-13T13:00:55Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the headroom change ripples to EVERY deepseek engine, so it must not 400 the small/live ones or blow the model limit.", "how_this_build_will_embody_it": "Section 4 risk-analyses the clamp; the tiny engines stay below it; a test locks the ceiling." },
  { "id": "§1.5.2", "read_at": "2026-08-13T13:01:05Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Think through the failure modes (provider-outage vs starvation; clamp-too-high) before shipping to all engines.", "how_this_build_will_embody_it": "H1/H2 + the enhanced log that confirms/refutes on the next occurrence." },
  { "id": "§2", "read_at": "2026-08-13T13:01:10Z", "source_file": "CLAUDE.md", "line_range": "52-75", "why_it_governs": "Diagnose before patching + no error loops — instrument so the fix is confirmable, don't retry a misdiagnosis with more force.", "how_this_build_will_embody_it": "The diagnostic log makes the root cause + the fix's sufficiency observable rather than assumed." },
  { "id": "A19", "read_at": "2026-08-13T13:01:25Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the LLM budget chokepoint + the dissect/after-pitch consumers in-tree before changing the token budget that every engine shares.", "how_this_build_will_embody_it": "Read deepseek.ts withReasoningHeadroom + salesDissect + the after-pitch hasSignal gate + the deepseek test in-tree before editing." },
  { "id": "§3.4", "read_at": "2026-08-13T13:01:15Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — the read must not FALSELY claim a 4–5 min call was a 'short exchange', and an empty LLM must not read as no-data.", "how_this_build_will_embody_it": "The fallback copy is corrected; the empty-content path already logs LOUDLY (INV22), now for truncation too." },
  { "id": "§6", "read_at": "2026-08-13T13:01:20Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — confirm the diagnosis + the clamp safety + the honest message before shipping a client-wide LLM budget change.", "how_this_build_will_embody_it": "Sections 2-4 + the passing deepseek tests." },
  { "id": "A22", "read_at": "2026-08-13T13:01:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads; minimum set present." },
  { "id": "A30", "read_at": "2026-08-13T13:01:40Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the safety property — the clamp that prevents a client-wide 400 must be a test, not a comment.", "how_this_build_will_embody_it": "New clamp test: total ≤ MAX_TOTAL_TOKENS ≤ 8192; small budgets keep full headroom." },
  { "id": "A38", "read_at": "2026-08-13T13:01:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
