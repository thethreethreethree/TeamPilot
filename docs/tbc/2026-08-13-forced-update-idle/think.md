---
tbc_version: 1
trigger: feature
started_at: 2026-08-13T21:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 2
---

# THINK — idle auto-update for the forced-update watcher (mobile agents stay current)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified this session.

## 2. Why (founder 2026-08-13: "auto update is a MUST for our system")
The forced-update watcher already (a) shows a Reload banner and (b) auto-reloads on a genuine reopen/revisit
(visibilitychange). But the team is MOBILE-FIRST, and an agent who keeps the app FOREGROUNDED and never taps the
banner nor backgrounds the app would stay on a stale bundle indefinitely — the exact "agents see the old version"
pain this whole system exists to kill. The founder made auto-update a hard requirement. So we add the missing
trigger: apply the held update when the page has been genuinely IDLE for a while.

## 3. The build
- `IDLE_AUTO_UPDATE_MS = 90_000` + an effect that (while stale) arms an idle timer; on `pointerdown/keydown/
  touchstart/scroll/wheel` it RE-ARMS (so any activity resets it). If the page sees NO interaction for the
  threshold, it calls the EXISTING `scheduleReload` — no new reload logic, so every guard already applies.
- Idle-only, so active work is never interrupted: typing, reading-while-scrolling, running a tool all re-arm it.
- Threshold locked to a sane band by a unit test (a tiny value would reload-storm; a huge value is useless).

## 4. Risk analysis (§1.5.1 — this reloads real agents' devices)
The idle path funnels through `scheduleReload` → `shouldForceReload`, so ALL existing safety guards hold: (1) never
while recording (`isRecordingActive`, re-checked at fire time AND inside scheduleReload); (2) at most once per
deployed commit (sessionStorage loop-guard) so a persistent commit/env drift can't loop-reload; (3) needs both
commits present + differing. So the idle trigger cannot reload during a call, cannot loop, and cannot fire on a
non-stale client. Worst case: a parked-but-being-read screen reloads and loses scroll position — no data loss
(typing re-arms). Listeners are passive + cleaned up on unmount/stale-change. Fully reversible (one revert).

## 5. Hypotheses (§1.5.2)
- **H1 — does it interrupt active work?** No: every interaction event re-arms the 90s timer, so it only fires on a
  genuinely idle tab. Typing/scrolling/tapping all reset it. CONFIRMED by construction + the guard composition.
- **H2 — can it reload-loop or reload mid-call?** No: it calls the same guarded scheduleReload (loop-guard +
  recording-guard, both unit-tested). The idle timer is only a TRIGGER, not new reload logic. CONFIRMED.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-13T21:00:10Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understanding precedes solving — understand WHY foregrounded mobile agents stay stale before adding a reload trigger.", "how_this_build_will_embody_it": "Section 2 identifies the uncovered case (foregrounded, never-tapped) from the recurring stale-client record, not a guess." },
  { "id": "§0.1", "read_at": "2026-08-13T21:00:15Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree (Section 1)." },
  { "id": "§1.5.1", "read_at": "2026-08-13T21:00:20Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — this reloads real agents' devices, so the idle trigger must compose with the recording + loop guards, not bypass them.", "how_this_build_will_embody_it": "Section 4: the idle path funnels through the existing guarded scheduleReload; no new reload logic." },
  { "id": "§1.5.2", "read_at": "2026-08-13T21:00:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK the failure modes (interrupt active work / reload loop / mid-call reload) before shipping a device-reloading behavior.", "how_this_build_will_embody_it": "H1/H2 reason through interruption + loop + recording; the re-arm-on-interaction design + guard composition answer them." },
  { "id": "§2", "read_at": "2026-08-13T21:00:35Z", "source_file": "CLAUDE.md", "line_range": "52-75", "why_it_governs": "Trace interconnections before committing a change to shared reload behavior.", "how_this_build_will_embody_it": "The idle trigger reuses scheduleReload rather than forking reload logic — one guarded chokepoint." },
  { "id": "§3.4", "read_at": "2026-08-13T21:00:40Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — the forced-update exists so agents never silently run a stale build; idle-update closes the last gap where they could.", "how_this_build_will_embody_it": "The mobile foregrounded-agent case is now covered, so 'agents see the old version' can't persist." },
  { "id": "§6", "read_at": "2026-08-13T21:00:45Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — confirm the guard composition + the honest tradeoff before shipping a device-reloading behavior.", "how_this_build_will_embody_it": "Sections 4-5 + the threshold sanity test + the passing shouldForceReload suite." },
  { "id": "A19", "read_at": "2026-08-13T21:00:50Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the forced-update watcher (scheduleReload + shouldForceReload + the existing guards) in-tree before adding a new trigger to it.", "how_this_build_will_embody_it": "Read VersionWatcher.tsx scheduleReload + the recording/loop guards before wiring the idle timer into them." },
  { "id": "A22", "read_at": "2026-08-13T21:00:55Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads; minimum set present." },
  { "id": "A30", "read_at": "2026-08-13T21:01:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the safety property — the idle threshold must be a test, not just a constant, so it can't be turned into a reload-storm.", "how_this_build_will_embody_it": "IDLE_AUTO_UPDATE_MS sanity test: >= 60s and <= 5min." },
  { "id": "A38", "read_at": "2026-08-13T21:01:05Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
