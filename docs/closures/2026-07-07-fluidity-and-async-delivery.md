# Closure — Sales Coach fluidity build + async/delivery read-audit (2026-07-07)

Founder directives this session: (A) reinspect the Sales Coach and make it more
*fluid* — the most important coaching, delivered timely, contextually proper —
researching before building, in strict accordance with the constitution +
ThinkerThinker.md, with special attention to AMD-006; (B) perform a complete
framework audit of the build against both documents. Plus a standing autonomous
build-continuation guard.

---

## Session-read manifest (§A22) — with an honest self-finding

**§A22 requires this manifest, AND catches a real violation in this very session:**

- **CLAUDE.md (§0–§7, incl. §1.5.1/§1.5.2 four-layer framework)** — in active
  context this session (full text present in the system prompt every turn). The
  §1.x/§3.x/§5 citations across this session's commits are grounded in that text.
- **ThinkerThinker.md A1–A22** — re-read **in full at the END of this session**
  (this turn: lines 1–500 then 501–762). **Self-finding (§A19/§A22):** the earlier
  commits of this session (`edb37d9` … `b149ca5`, ~26 commits) cited A-clauses
  (A2, A8, A14, A15, A16, A21, A22) from the **memory index's cached labels**, not
  from session-reading the asset itself. That is exactly the A22 failure —
  "constitutional citations without session-reading are §A19 + §A9 violations
  operating undetected." It is surfaced here rather than hidden. Having now
  re-read the assets, I confirm the earlier citations were *accurate to the assets'
  intent* (checked below), but accuracy-from-memory is not the discipline; the
  discipline is reading-then-citing, and this manifest is the corrective artifact.
- **AMD-006 (four-layer framework + §1.5.1 + §1.5.2)** — in active context via
  CLAUDE.md §1.5.1/§1.5.2; the standalone amendment file was not re-opened this
  window. The layer-2/layer-3 citations are grounded in the CLAUDE.md text.

**Per-asset embodiment check (§A22 step 3) — how this build embodies each cited asset:**

- **A2 (design backwards from the §4 readout).** The fluidity work built the
  measurement first: `cueInstrument` records a per-stage latency breakdown, and the
  timing *optimization* was deliberately DEFERRED to the readout rather than guessed.
  Embodied. The late fix (readout now aggregates per-stage medians) is A2 correcting
  a case where the readout couldn't yet answer its own §4 question.
- **A8 (growth-aware participant).** Winning-lines grounding injects the rep's OWN
  proven closing lines into the cue prompt — the System participates in this rep's
  growth, not generic advice. Embodied.
- **A14 (data path ≠ render path; verify every branch).** Verified the readout
  wiring end-to-end (trace on every invokeCue branch → summary on stop → UI) and the
  grounding wiring end-to-end (session.agentId → prompt repBlock). Also the source
  of the "run the full suite after a query-shape refactor" correction. Embodied.
- **A15 (a flag honestly diagnosed may close without a fix).** Push delivery and
  CRM append-only were both investigated and closed as SOUND with on-record
  diagnosis, no code change. Embodied — resisted the ship-a-fix-to-look-green pull.
- **A16 (multi-tool composition).** The C.A.R.E email AI first-responder is the same
  path as the widget; flagged where it does NOT compose (never dispatches outbound).
- **A21 (cross-module composition / same-class across modules).** The concurrent-void
  race found in the inbound-email route was checked across its siblings (widget
  create→message flow, the notify path) — same class, traced across modules, not
  assumed. Embodied.
- **A20 (never "you decide" without a recommendation).** Every founder-gated flag
  below carries an explicit recommendation.

---

## Scope + module coverage map (§A20/§A21 boundary honesty)

**Worked/audited deeply this session:**
- Sales Coach fluidity cue path — `cueInstrument`, `cueDelivery`, `liveCue`
  (generateLiveCue parse), `liveCuePrompt`, `winningLines`, `getRepWinningLines`,
  the readout wiring in `useLiveCoaching`, the UI readout in `LiveCoachingPanel`.
- Sales Coach live path — start/stop/ws handlers, finalize, unmount cleanup.
- C.A.R.E inbound-email route + `routeNewConversation` + notify + `runAiFirstResponder`.
- Push path — `sender.ts`, root `public/sw.js`, `useNotificationSubscription`.
- CRM append-only — `crm/data.ts` writes + 0049 triggers + 0086 immutability.

**NOT audited this session (named per §A20, not silently skipped):** the core
diagnosis/signals engine internals (relied on the 2026-07-06 ground-up audit),
Team Chat message/pin internals, dashboard/Command Center, Learning Mode surfaces,
Feedback/Settings/Marketing pages, AI subsystem routes beyond cue/care, demo mode,
white-label. These are explicit not-audited-this-round.

---

## What shipped (by disposition)

**Fixes (real bugs, live path):**
- Live status stuck "live" after a dropped socket — stale closure (`171797a`).
- Mic/socket/context leak on unmount — no cleanup effect existed (`f5d5605`).
- Transcript double-fire on double-finalize — client guard (`7ad1a37`).
- Inbound-email routing race — `routeNewConversation` awaited so the notify + AI
  responder read post-assignment state (`6e1bb5a`). Fixed 3 coupled races at once;
  non-outward-facing.

**Features / improvements (fluidity delivery + readout):**
- Cue instrumentation, single-best-cue delivery gate, importance rating,
  rep's-own-winning-lines grounding (`edb37d9`, `42d659a`, `8e012e8`, `31c3b9c`).
- Readout now names WHERE the delay lives — per-stage medians (`a061bbb`).

**Tests added (silent-failure guards for previously-uncovered load-bearing logic):**
- `routeNewConversation` ai_responding coupling (`03264fb`).
- `getRepWinningLines` query composition (`b149ca5`).
- `generateLiveCue` response parse (`d48d4e8`).
- Readout per-stage breakdown assertions (in `a061bbb`).

**Verified SOUND, closed without a fix (§A15):** push path end-to-end; CRM
append-only scoping; the winning-lines grounding wiring; the importance-parse
fail-safes; `detectHandoffSignal` (already well-covered).

---

## Founder-gated findings (full detail + recommendations in FOUNDER-ACTIONS-2026-07-06.md)

- 🔴 **Email AI first-responder never sends outbound** (AMD-006 layer-2). AI writes
  replies that never reach the customer. *Recommend:* enable outbound dispatch after
  a test-tenant quality review; it makes the AI autonomously email customers
  (outward-facing) so it needs the founder's yes. Sequencing groundwork already laid.
- 🟡 **Widget first-turn ai_responding race** — possibly by-design (AI first-touch
  while a human picks up). *Recommend:* your call, defect vs feature.
- 🟡 **Transcript UNIQUE(session_id, seq)** and **label-transcript mixing** —
  §3.1-sensitive dedup; needs founder OK before touching the append-only transcript.
- **Push delivery** — narrowed to VAPID config; the `[push-sender]` log names the cause.
- Pre-existing: inbound-email AI rate-limit cap, HSTS header, migrations 0085/86/87.

---

## Gate at closure

`npm run check` green: **312 tests passed / 3 skipped** (integration, live-DB gated),
typecheck + lint + `rls:audit` (0 missing) clean. 28 commits, all pushed to `main`,
tree clean (only a pre-existing untracked design asset, not mine).

## A22's own test

Does this closure produce the session-read manifest before the founder asks for
one? Yes — this file is that artifact, and it self-reports the cached-label
citations rather than hiding them. That is the catch-metric improvement A22 asks
for: the agent self-producing the manifest, including its own violation, rather
than the founder forcing the accounting.
