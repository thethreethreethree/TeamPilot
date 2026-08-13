---
tbc_version: 1
trigger: audit
started_at: 2026-08-13T22:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 2
---

# THINK — full-build audit of the recent build (founder: "audit the recent build fully")

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why
Founder asked to audit the recent build fully. The recent build is the auto-update (VersionWatcher: banner +
revisit + idle + foreground-poll) and the extension fixes (single-flight refresh, restart button, connect
fallback). I already found one gap myself (F2 foreground poll, shipped). To beat the builder's blind spot I spawned
TWO independent adversarial review subagents — one on VersionWatcher, one on the extension changes — and traced
every finding against the code (§1.2 record-check: a finding is a SUSPECT, verified before fixing).

## 3. Findings kept (verified real) + the fix
- **A1 HIGH (VersionWatcher)** — `markTriedCommit` spent the once-per-commit budget BEFORE the 1.5s beat, so a
  reload aborted for a recording-in-the-beat left the commit marked "tried" → every later trigger no-ops → the
  auto-update is DEAD for that commit, stranding the client. Fix: write the budget only inside the timer, right
  before the actual `window.location.reload()`.
- **A2 MED (extension)** — single-flight coalesces TIME-OVERLAPPING refreshes only; callers capture the refresh
  token at call-start, so a SLOW call (upload/stream) that 401s after a FAST call rotated the token replays the
  CONSUMED token → Supabase reuse-detection → session killed (the founder's own "kicked out" bug, narrowed not
  closed). Fix: re-read the latest refresh token from chrome.storage.local AT refresh time (both extensions).
- **A3 MED (VersionWatcher)** — the manual Reload button had no recording guard; a reflexive mid-call tap destroys
  the recording. Fix: confirm during a live recording.
- **A4 LOW (VersionWatcher)** — `reloadTimerRef` never cleared on unmount + no unmounted guard → reload/setState on
  a torn-down mount. Fix: `unmountedRef` + clear the timer in cleanup + guard the beat and the async check().
- **A5 LOW (VersionWatcher)** — `visibilitychange` on `window` vs `document` (load-bearing revisit path). Fix: align
  to `document`.
- **A6 LOW-MED (extension)** — restart button doesn't check `toolBusy`; restarting mid-run races #sc-out + shows a
  false "ready". Fix: no-op restart with a "still running" note while `toolBusy`.

## 4. Findings ACCEPTED (not bugs / by-design)
- Recording flag is a boolean not a refcount → the module hard-lock (companies.access_module) confines an account
  to ONE module, so two live recordings in one tab can't happen. Non-issue.
- Private-mode disables the auto-update (storage throws → treated as tried) → the documented safe "can't guard the
  loop → don't loop" tradeoff.
- A revisit dropped if a poll check() is in flight → degrades gracefully (idle/next revisit still reload).
- Sales connect login round-trip drops `?ext=` → recovers via the guidance card (one extra hop). LOW; deferred
  (threading `ext` into state for a graceful-degradation case is not worth the added surface now). Flagged.

## 5. Hypotheses (§1.5.2)
- **H1 — does A1's fix keep the loop guard intact?** Yes: markTriedCommit still writes BEFORE `location.reload()`,
  so it persists across the reload; only an ABORTED (recording) attempt now skips it. CONFIRMED by trace.
- **H2 — does A2's re-read close the reuse race?** A late refresher reads the freshly-rotated token, so each token
  is used once (fast uses R0, slow uses R1) → no reuse. Combined with the single-flight (overlapping coalesced),
  both variants covered. CONFIRMED.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-13T22:00:10Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand each finding from the record before fixing — a finding is a suspect.", "how_this_build_will_embody_it": "Section 3/4 verify each agent finding against the code; accepted ones are reasoned, not dismissed." },
  { "id": "§0.1", "read_at": "2026-08-13T22:00:15Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1)." },
  { "id": "§1.2", "read_at": "2026-08-13T22:00:20Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective/record-check: an audit finding is a SUSPECT — verify against the actual code before fixing.", "how_this_build_will_embody_it": "Each of A1-A6 confirmed against the file; 4 findings accepted-as-not-bugs with reasons." },
  { "id": "§1.5.1", "read_at": "2026-08-13T22:00:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the fixes touch the reload chokepoint + the shared recording flag + both extensions; trace ripples.", "how_this_build_will_embody_it": "Fixes keep the single guarded scheduleReload chokepoint; the recording/loop guards are preserved." },
  { "id": "§2", "read_at": "2026-08-13T22:00:40Z", "source_file": "CLAUDE.md", "line_range": "52-75", "why_it_governs": "Diagnose before patching + no error loops.", "how_this_build_will_embody_it": "Independent adversarial review located the root causes (budget-timing, per-call token capture) before the fixes." },
  { "id": "§1.5.2", "read_at": "2026-08-13T22:00:35Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive THINK-then-search audit: form failure hypotheses, then confirm against the code — quality over quantity.", "how_this_build_will_embody_it": "H1/H2 + the two adversarial agents' traced findings; accepted-not-bug items are reasoned, not noise." },
  { "id": "§6", "read_at": "2026-08-13T22:00:42Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — confirm each fix's ripple (loop guard, recording guard) before shipping device-reloading + auth changes.", "how_this_build_will_embody_it": "Sections 3-5 trace each fix's guard-preservation; the passing suite + gate." },
  { "id": "A30", "read_at": "2026-08-13T22:00:52Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate safety properties with tests where testable.", "how_this_build_will_embody_it": "The reload DECISION (shouldForceReload) + thresholds stay unit-tested; the untestable timer/chrome-API changes are traced + syntax-checked (R1)." },
  { "id": "A19", "read_at": "2026-08-13T22:00:50Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the auto-update + extension refresh code in-tree before changing them.", "how_this_build_will_embody_it": "Read scheduleReload + the guards + both doRefresh + the restart handler before editing." },
  { "id": "A22", "read_at": "2026-08-13T22:00:55Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads; minimum set present." },
  { "id": "A38", "read_at": "2026-08-13T22:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
