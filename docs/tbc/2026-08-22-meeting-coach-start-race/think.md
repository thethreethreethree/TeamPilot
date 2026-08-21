---
started_at: 2026-08-22T00:25:00+08:00
---

# THINK — Meeting hook start() Stop-during-setup guard

**Problem.** The adversarial review's 5th item (below the 4 fixed bugs): `useMeetingCoaching.start()` checked only
`unmountedRef` — not `stoppedRef` — after each of its setup awaits (getUserMedia, token fetch, ctx.resume). So
tapping **Stop** during the ~1–2s startup let `start()` continue past the await, build a fresh ctx/ws on the
already-torn-down stream, and flip status back to "live" — a zombie session after Stop.

**Scope decision (why only the meeting hook).** The review flagged this as a SHARED pattern — `useLiveCoaching`
(the LIVE sales hook) has the identical code. Fixing the sales half touches the load-bearing, untestable sales
business and I won't do that under the build guard without founder awareness (§5 — the builder under pressure);
it stays FILED. But the meeting hook is new code with ZERO sales risk, and this is a real (if low-frequency)
bug, so its safe half is fixed now. The two halves diverging is acceptable: the meeting hook being more
defensive is not a harmful divergence, and the sales fix remains filed for a coordinated founder-aware pass.

**The fix.** `if (unmountedRef.current || stoppedRef.current) return teardown();` at all three post-await points.
`stoppedRef` is reset to false at the top of a fresh start and is false during a reconnect, so the guard is a
NO-OP in the normal path — it only fires when the facilitator tapped Stop mid-setup.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Understanding precedes solving — this fixes the specific race the review traced, matched to the sales guard it mirrors.",
    "how_this_build_will_embody_it": "The guard is the exact stoppedRef check the sales hook's stop path already relies on, applied at the meeting hook's awaits." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The governing methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Layer-2 effectivity — a zombie 'live' session after Stop is the feature not working as invoked.",
    "how_this_build_will_embody_it": "Stop during setup now tears down cleanly instead of building a zombie ctx/ws." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Act on what the review surfaced, at the right scope.",
    "how_this_build_will_embody_it": "Fixed the zero-risk meeting half; kept the risky sales half filed rather than manufacture a risky change under pressure." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The biggest risk is the builder under pressure — the temptation to touch the live sales hook for a marginal race.",
    "how_this_build_will_embody_it": "Declined the sales-hook change under guard pressure; only the new-code half, which cannot regress the sales business, was touched." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood the race from the review, scoped to the safe half, stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Methodology read in-session, not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session before this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "A lesson in prose returns unless encoded — this mirrors the sales hook's encoded stop-guard.",
    "how_this_build_will_embody_it": "The guard is device-confirmed like its sales origin; the shared latent remains filed as a coordinated follow-up." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3572 tests, exit 0), pasted in check.md." }
]
```
