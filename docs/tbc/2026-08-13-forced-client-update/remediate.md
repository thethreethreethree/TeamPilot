# REMEDIATE — F1 stale clients stuck on an old build

## F1 — deployed fixes weren't reaching running clients
Root cause: an installed iOS PWA resumes its last in-memory bundle instead of re-fetching, so it can run
arbitrarily old code. The VersionWatcher detected this (health commit ≠ baked commit) but only PROMPTED — a client
that ignored the banner stayed stale forever, so the capture fix never reached the first client.

Remediation (founder-directed: keep the banner PRIMARY, add a SECONDARY forced auto-update):
1. On a genuine reopen/revisit (document hidden→visible), auto-reload the stale client. NOT on the initial view /
   active session — never yank a session mid-use.
2. GUARD 1 — never auto-reload during a live recording: both recording surfaces (LiveCoachingPanel `live`, CARE
   useVoiceMode `voiceMode`) set `document.body[data-recording]`; the watcher holds and applies on
   `elostate:recording-ended`. Interrupting a call is the exact failure the capture fix exists to prevent.
3. GUARD 2 — reload at most once per deployed commit (sessionStorage keyed on the live commit); persistent drift
   or unavailable storage → no auto-reload (manual banner remains). No infinite loop.
4. Extract the decision as the pure `shouldForceReload` and unit-test it (7 cases) — the safety-critical branch
   logic must fail a test on regression, not a client.

Boundary (A26): client convergence only. Does NOT fix the root STT capture failure (ElevenLabs scope env fix,
founder-gated) nor recover audio never saved on an old client.

Outcome: fixed. class: delivery gap. severity: high. Every client now converges to the current build so future
sessions get every fix.
