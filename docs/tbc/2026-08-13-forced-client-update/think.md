---
tbc_version: 1
trigger: feature
started_at: 2026-08-13T09:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 2
---

# THINK — secondary forced auto-update so no client stays on an old build

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (founder incident 2026-08-13 — clients stuck on old mobile builds)
The founder reported the capture issue "still persisting" with a screenshot showing the "A new version of the app
is available · Reload" banner — i.e. the client was on an OLD build that predates the capture fix. Diagnosis: the
xp persist-on-Stop fix IS deployed (`87881e83` is in HEAD), and the persist code is sound — but an installed iOS
PWA RESUMES its last in-memory bundle instead of re-fetching, so a client can run arbitrarily old code. The
existing `VersionWatcher` DETECTED this but only PROMPTED (never auto-reloaded, by an earlier deliberate "don't
interrupt work" choice), so a client that ignored the banner stayed stale forever. Founder directive (clarified):
keep the Reload banner as the PRIMARY path, and add a SECONDARY system — "if they don't hit reload, the app
auto-updates after they reopen or revisit."

## 3. The design (two update paths + two safety guards)
- **PRIMARY** — banner shows on any stale detection; tapping Reload updates now (unchanged intent).
- **SECONDARY** — on a genuine REOPEN/REVISIT (the document went hidden then visible again — the iOS-PWA-resume
  moment), auto-reload. NOT on the initial view / active session — never yank a session mid-use.
- **GUARD 1 (never interrupt a call):** LiveCoachingPanel + CARE useVoiceMode set `document.body[data-recording]`
  while a live recording is on; the watcher holds the auto-reload then and applies it on `elostate:recording-ended`
  or the next revisit. Interrupting a recording is the exact failure the capture fix exists to prevent.
- **GUARD 2 (no reload loop):** reload at most once per deployed commit (sessionStorage keyed on the live commit).
  If the client comes back STILL stale against the same commit, the reload didn't take (a persistent commit/env
  drift — e.g. the two-Vercel-projects skew in the record) → stop, keep the manual banner, never loop. Storage
  unavailable → treat as already-tried (don't auto-reload) — safe over a possible loop.
- The safety-critical decision is extracted PURE as `shouldForceReload(...)` and unit-tested (the component is
  node-untestable), because a regression here could ship a reload loop or a call interruption to every client.

## 4. Boundary (§1.5.1 / A26)
Client-side update mechanism only — no server/schema change. It does NOT fix the ROOT capture failure (empty STT
transcript = the ElevenLabs scope env fix, founder-gated) and does NOT recover an ALREADY-lost session (audio that
was never saved on the old client is gone). It ensures every client CONVERGES to the current build so future
sessions get every fix. A session with no recorded blob (live coaching never started, mic denied) still correctly
shows "you have to be recording" — that is upstream of this and unchanged.

## 5. Hypotheses (§1.5.2)
- **H1 — can it loop?** No: guard 2 reloads at most once per commit; a successful update makes BAKED===live (not
  stale) so it never re-triggers; a persistent drift stops after one attempt. CONFIRMED by the `shouldForceReload`
  tests (already-tried → false) + the sessionStorage keying.
- **H2 — can it interrupt a live call?** No: guard 1 holds while `data-recording` is set (both recording surfaces
  set it), re-checks at fire time, and defers to `recording-ended`. CONFIRMED by the recordingActive → false test
  + the body-flag wiring in both LiveCoachingPanel and useVoiceMode.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-13T09:30:20Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Diagnose WHY clients are stale (PWA resume) from the record before building the force, not theorise a fix.", "how_this_build_will_embody_it": "Section 2 diagnoses the resume mechanism + confirms the persist fix is already deployed + sound." },
  { "id": "§0.1", "read_at": "2026-08-13T09:30:20Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-13T09:30:40Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective — the stale-client + multi-Vercel-drift risks are on the record; guard 2 is built directly from that recorded loop hazard.", "how_this_build_will_embody_it": "Guard 2 defends the exact commit/env drift the record documents; section 2 confirms the deploy from HEAD." },
  { "id": "§1.5.1", "read_at": "2026-08-13T09:30:55Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — a forced reload ripples into EVERY recording surface (sales-coach + CARE voice) and into the deploy-drift failure mode; both must be guarded.", "how_this_build_will_embody_it": "Both recording surfaces set the guard flag; guard 2 handles the drift; section 4 draws the root-cause boundary." },
  { "id": "§1.5.2", "read_at": "2026-08-13T09:31:05Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Think through the failure modes (loop, call-interrupt) BEFORE shipping to all clients.", "how_this_build_will_embody_it": "H1/H2 enumerate + test both; the pure decision is unit-tested." },
  { "id": "§3.4", "read_at": "2026-08-13T09:31:15Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — the banner must say what's happening (waiting vs updating), and the mechanism must not pretend to fix the root capture failure.", "how_this_build_will_embody_it": "Banner text switches on `reloading`; section 4 is explicit that this converges builds, it does not fix STT or recover lost audio." },
  { "id": "§6", "read_at": "2026-08-13T09:31:20Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — confirm the guards + the un-yanked-session behaviour before shipping a client-wide reload.", "how_this_build_will_embody_it": "H1/H2 + the revisit-gated (not mount-gated) auto-reload." },
  { "id": "A19", "read_at": "2026-08-13T09:31:25Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the existing VersionWatcher + the service worker + both recording surfaces in-tree before changing the update behaviour, so the force composes with what's there (SW pass-through, the health endpoint, the recording lifecycles).", "how_this_build_will_embody_it": "Read VersionWatcher, public/sw.js, LiveCoachingPanel, and useVoiceMode in-tree; the design reuses the existing health check + adds the guards where the recording state actually lives." },
  { "id": "A22", "read_at": "2026-08-13T09:31:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads." },
  { "id": "A30", "read_at": "2026-08-13T09:31:40Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the safety-critical lesson — a reload-loop / call-interrupt regression must fail a test, not a client.", "how_this_build_will_embody_it": "`shouldForceReload` extracted pure + 7 unit tests locking both guards + the force + the false-positive cases." },
  { "id": "A38", "read_at": "2026-08-13T09:31:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
