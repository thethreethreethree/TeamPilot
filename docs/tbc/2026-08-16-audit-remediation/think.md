---
tbc_version: 1
trigger: fix
started_at: 2026-08-16T12:00:00Z
doc_hashes:
  CLAUDE.md: 3325eedc1e905b2798d196dae087664e3da7031a66005b1f89379b6da959a9e3
  ThinkerThinker.md: 19d6ff103082c1f29ee98653b84cce2a26308352511756f6e104a8db36df84c9
manifest_entries: 12
hypotheses: 1
---

# THINK — 2026-08-16 system-audit remediation

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (3325eedc…) + ThinkerThinker.md (19d6ff10…) hashes equal DOC_MANIFEST.json. No amendment.

## 2. Why (from the record §1.2)
A founder-requested full system audit (four parallel lenses) confirmed the system is in strong shape —
zero cross-tenant leaks across finance/care/chat/files/team + the new monitoring exemption. It surfaced
a small set of real findings; the founder selected all of them to fix. This build remediates them.

## 3. The findings + fixes (ranked)
- **#1 HIGH (honesty §3.4):** live-coaching banner said "nothing is being captured" during an STT-feed
  drop while the recorder was STILL capturing — a rep would abandon a recoverable call. Fix: a truthful
  `audioCapturing` signal from the hook + copy extracted to the pure `notRecordingBanner()` (unit-tested).
- **#2 MED (prompt injection):** `ask-coach` fed the raw transcript (customer speech) to the LLM unfenced.
  Fix: append `CONVERSATION_IS_DATA`; close the guard blind spot with **INVARIANT 25** (coach API routes
  that pull a transcript + call an LLM directly must fence — INV23/24 only scanned engine dirs).
- **#3 MED (accountability):** monitoring audit-log swallowed failures silently. Fix: log the failure +
  fail LOUD on the session-detail read (don't serve a transcript that couldn't be recorded).
- **#4 (already closed):** monitoring allowlist boundary now has a data-layer test.
- **#5 LOW:** forced "Coach me now" showed an LLM error as "nothing to add". Fix: rethrow on the forced
  path so it surfaces honestly (auto path still swallows to silent — a live call is never disrupted).
- **#6 LOW:** team-invite share links built from `window.location.origin` → `siteUrl()` (origin-drift class).
- **#7 LOW:** static drift-guard that `is_vendor_super_admin()` (0089) literal equals `VENDOR_COMPANY_ID`.
- **#8 DEFERRED:** ESLint-config bump is a framework-version change that can break lint/Vercel — needs its
  own verify cycle, not batched here (flagged to founder).

## 4. Interconnections traced (§1.5)
- The `audioCapturing` state is set only where the recorder actually starts/stops — it can't lie.
- #5's rethrow is gated on `args.force`, preserving "auto cues never disrupt a live call".
- INV25's trigger (getSessionTranscript + a direct LLM caller) matches only the ask-coach shape; routes
  that delegate to fenced v5 engines don't match (verified: only ask-coach + extension/suggest call an LLM
  directly, and suggest fences via the INV24-guarded builders).

## 5. Hypothesis (§1.5.2)
H1: each fix removes its defect without regressing its subsystem — verified by the full gate (2944 tests),
INV25 detection tamper-test, and the new unit tests for #1/#3/#4/#7.

## Session-read manifest (A22 / A35)

```json
[
  { "id": "§0", "read_at": "2026-08-16T12:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand each defect's root cause before fixing.", "how_this_build_will_embody_it": "Each fix traced to its mechanism (recorder lifecycle, fence scope, audit contract) before editing." },
  { "id": "§0.1", "read_at": "2026-08-16T12:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes match; no amendment." },
  { "id": "§1.5.1", "read_at": "2026-08-16T12:01:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 effectivity — the honesty fixes must make the surface TRUE, not just compile.", "how_this_build_will_embody_it": "Banner + cue copy now reflect reality; unit-tested." },
  { "id": "§1.5.2", "read_at": "2026-08-16T12:01:20Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search — audit found these; fixes verified against the real flow.", "how_this_build_will_embody_it": "Traced engine→route→client before rethrowing on #5." },
  { "id": "§3.4", "read_at": "2026-08-16T12:01:40Z", "source_file": "CLAUDE.md", "line_range": "330-345", "why_it_governs": "Honesty / no false state — #1, #3, #5 are all error-dressed-as-no-data.", "how_this_build_will_embody_it": "Banner tells the truth; audit fails loud; forced-cue error surfaces." },
  { "id": "§6", "read_at": "2026-08-16T12:02:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — real vs incidental constraint, holistic ripple.", "how_this_build_will_embody_it": "#5 preserves the live-call guarantee; #8 deferred as a real-risk constraint." },
  { "id": "A19", "read_at": "2026-08-16T12:02:20Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult in-tree code before changing.", "how_this_build_will_embody_it": "Read the recorder lifecycle, cue flow, fence usage, siteUrl before editing." },
  { "id": "A22", "read_at": "2026-08-16T12:02:40Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Every cited asset opened this session." },
  { "id": "A30", "read_at": "2026-08-16T12:03:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "INV25 (fence), notRecordingBanner test (#1), boundary test (#4), drift-guard (#7) — all detection-checked." },
  { "id": "A38", "read_at": "2026-08-16T12:03:20Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = command + output.", "how_this_build_will_embody_it": "closure.md pastes the gate output + exit code + INV25 tamper result." },
  { "id": "§1.2", "read_at": "2026-08-16T12:03:40Z", "source_file": "CLAUDE.md", "line_range": "200-210", "why_it_governs": "Retrospective — the fixes come from the audit record of what was found.", "how_this_build_will_embody_it": "Each fix maps to a ranked audit finding, remediated from evidence." },
  { "id": "§1.5", "read_at": "2026-08-16T12:03:55Z", "source_file": "CLAUDE.md", "line_range": "78-100", "why_it_governs": "Holistic — trace each fix's ripple (live-call guarantee, fence scope, audit contract).", "how_this_build_will_embody_it": "Section 4 traces the interconnections; #5 preserves the auto-cue guarantee." }
]
```
