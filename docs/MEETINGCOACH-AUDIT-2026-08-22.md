# Meeting Coach — §1.7 ground-up audit (2026-08-22, shipped in-person MVP)

Supersedes the 2026-08-21 audit (which covered the *unwired* strategy core). This audits the **shipped**
in-person MVP: server wiring (`129e3c01`), client (`4f5c4538`), hardening (`9eda105a`), durable audio
(`6fe34caa`), and the adversarial-review fixes (`4d5d7791`). Outside-view (§1.3), foundation-up. Each layer:
SOLID / FLAG (severity) / MISSING. An empty flag list would itself be suspicious (§1.7.3).

Severity: **H** blocks correct operation · **M** real gap, degrades but doesn't block · **L** advisory/latent.

---

## Layer 0 — env / config (A41)
- SOLID: introduces NO new external precondition — reuses the sales ElevenLabs (STT + TTS), DeepSeek, and
  `/realtime-token` / `/tts` config already in place.
- FLAG **H (flagged, not silent)** — migration **0237 must be applied** (`npm run db:apply`); until then the
  create route returns a fail-honest 500 naming the cause and NO meeting session exists. Correct fail-loud
  posture; blocking until applied.
- Inherited (from the 08-21 audit, pre-existing in Sales Coach): the Settings voice-health probe checks STT
  scope only (not TTS); LLM-provider health isn't surfaced in `/api/health`. Not meeting-specific.

## Layer 1 — types
- SOLID: `npm run check` typecheck clean; 3572 tests green. `session_kind` typed through `SalesSession`;
  `CoachingMode`/`CueMode` total; the mode→CHECK mapping is exhaustive over `CueMode` (compile error on a new
  value, not a runtime CHECK violation).

## Layer 2 — schema (0237)
- SOLID: `session_kind` is additive, CHECK-constrained (`sales|meeting|huddle`), default `sales`, indexed
  `(company_id, session_kind, started_at desc)`. A34 write-safety: the column is written ONLY for a
  meeting/huddle create — the sales path omits it (byte-identical + safe on a pre-0237 DB), locked by a
  drift-guard test on the insert payload.

## Layer 3 — RLS
- SOLID: `coaching_sessions` RLS is inherited unchanged; `session_kind` adds no new RLS surface. The cue + create
  routes owner-gate at the route layer (service-role writes) — verified.
- FLAG **L–M (latent — safe only because no consumer exists yet)** — `coaching_cues` SELECT policy is
  **COMPANY-scoped, not owner-scoped** (`0070:188-196`): any same-company user can read a facilitator's meeting
  cues via RLS. There is NO meeting cue-read path today, so nothing exposes them yet. **When the post-meeting /
  Dissect view is built**, decide owner-vs-company visibility: if meeting cues should be private to the
  facilitator, add a route-layer owner-gate on the read (the sales A18 pattern), because RLS alone will let a
  colleague read them. File against the Dissect build.

## Layer 4 — data
- SOLID: `createSession` (A34-safe write, drift-guard tested), `appendCue` (session-generic insert), `getSession`
  (company-scoped read, throws-not-null on error per INV22) all verified session-generic — a meeting row flows
  through them identically to a sales row, confirmed by reading each.

## Layer 5 — API
- SOLID: `POST /meeting-session` (create — owner=current user, company-scoped, rate-limited, 5 tests) and
  `POST /meeting-session/[id]/cue` (owner-gated, mode-routed → 400 for a sales session, mode-mapping chokepoint +
  latency, 7 tests). Reused `/audio-chunk` + `upload-recording/*` verified session-generic (owner-gated, no
  `session_kind` filter).

## Layer 6 — discipline (§3 honesty thesis)
- SOLID: cues are append-only events (`coaching_cues`); the cue-status surface makes a forced-cue failure honest
  (no silent dead button); the error/stop path returns to setup (no dead-end); cross-session cue bleed closed
  (epoch guard).
- FLAG **M** — **controlExempt (day-1 cues, founder decision) removes the §3.4 control-month baseline**, so the
  §3.5 "did meetings actually improve?" measurement loses its clean before/after. This is a founder-accepted
  trade (faster value over the baseline). **Consequence for the future Dissect:** meeting-improvement must be
  measured WITHOUT a control month — e.g. a trend over time, or a baseline harvested from early meetings even
  with cues on. Surface this in the §3.5 measurement decision, don't let Dissect silently grade agreement.

## Layer 7 — presentation
- SOLID: theme-legible in light + dark (semantic tokens, theme:audit green); earpiece-gated Start; prominent cue
  + status; workflow continuity (endSession → setup).
- FLAG **L** — no nav entry: `/dashboard/meeting-coach` is reachable only by URL. Founder-gated (belongs in the
  Team-Sync section, which doesn't exist yet — placing it under Sales Coach would misfile a Team-Sync feature).
- FLAG **L** — auto-coach defaults ON (sales defaults OFF, founder 2026-07-28). Defensible (the facilitator
  opted into a coached meeting), founder-tunable.

## Cross-cutting
- RESOLVED: the adversarial review's four correctness bugs (cross-session cue bleed, unbounded reconnect, silent
  dead button, per-session state bleed) — all fixed (`4d5d7791`).
- FLAG **L (filed)** — shared `start()` race: both `useLiveCoaching` and `useMeetingCoaching` check only
  `unmountedRef` (not `stoppedRef`) after their setup awaits (Stop-during-startup zombie session). Low frequency;
  a coordinated both-hooks fix that touches the LIVE sales hook — filed for founder awareness, not patched
  one-sided.

## Verdict
The shipped in-person MVP is **structurally sound at every layer** (0–7). No **H** flag except the expected
"apply 0237" precondition. The two findings worth carrying forward are both **against future builds**: the
`coaching_cues` company-scoped RLS (owner-gate the future meeting cue-read) and the missing control baseline
(the §3.5 Dissect-measurement decision). Neither blocks the MVP; both must be honored when their consumer is
built. Device validation (the one headless-unverifiable layer) remains the founder's, tooled by
`docs/MEETINGCOACH-DEVICE-VALIDATION.md` + `scripts/diag-meeting-session.mjs`.
