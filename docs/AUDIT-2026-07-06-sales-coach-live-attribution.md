# Focused audit — Sales Coach live attribution + cue path — 2026-07-06

> Outside-view audit (§1.3) under [CLAUDE.md §1.7](../CLAUDE.md) / [§1.5.2](../CLAUDE.md),
> scoped to the subsystem the founder asked to "microscopically examine": live
> identification of Agent vs Prospect, and live cue response time + accuracy.
>
> Stance: I read this path as if I had not built it. Output: honest flags, not
> blockers. Findings are tagged **[fixed this session]**, **[surfaced — founder-gated]**,
> or **[accepted tradeoff]**. Compare against the baseline system audit
> [AUDIT-2026-06-02](AUDIT-2026-06-02.md) and the ground-up audit recorded in
> memory (2026-07-06).

## Severity scale

- 🔴 **Critical** — undermines a constitutional rule or blocks real-customer use
- 🟠 **High** — meaningful product risk; fix before paid customers
- 🟡 **Medium** — quality / hygiene; compounding, not blocking
- 🟢 **Low** — polish; defer without guilt

---

## Layer A — Attribution accuracy (who spoke: Agent vs Prospect)

Files: `speakerAttribution.ts`, `attribute/route.ts`, `pitchSeparation.ts`,
`useLiveCoaching.ts` (commit handler).

**Solid**
- Signals **compose, don't contradict** (A16): `composeProvisional` priority
  manual (ground truth) > content tell > trusted pitch > loudness. Pinned by test.
- The `/attribute` prompt is **content-first** with an explicit offer-vs-ask
  asymmetry (OFFER "I can give you detail" = seller; ASK "give me detail" =
  prospect); loudness demoted to a weak tiebreaker. This directly reverses the
  root cause of the founder's live-test bug (loudness as a "strong prior").
- Instant `guessSpeakerFromContent` fires only on an **exactly-one-side** match,
  returning null on lookalikes ("how much detail do you want") — high precision.
- Pitch separator **will not fabricate a second speaker** from one voice (tested)
  and honestly reports low confidence when two voices are near-identical (§3.4).
- Pitch detector **never emits a confident F0 outside [70,400]** — pinned this
  session so a mislabel can't originate from an out-of-range acoustic artifact.

**Flags**
- 🟠 **Mic-only video misapplies two-speaker attribution.** *[surfaced —
  founder-gated, part of the video A/B]* In video mode the mic is agent-only,
  but the content-tell + LLM attribution still run and can label an agent turn
  "customer" (e.g., the rep rehearsing "how much does it cost"), creating
  phantom-prospect turns the cue engine reasons over. The pitch *cluster* is
  safe; the content/LLM label is not. Resolution depends on the A/B: mic-only ⇒
  force all video turns "agent"; far-end capture (`getDisplayMedia`) ⇒ leave as
  is. Do not rewire until the A/B is decided.
- 🟡 **Content tells are English + literal-set (A13).** Non-English or heavily
  idiomatic turns fall through to voice/LLM. Acceptable now; note for i18n.

---

## Layer B — Cue response time (latency)

Files: `useLiveCoaching.ts` (`classifyTurn`, commit scheduler), `liveCue.ts`.

**Solid**
- **L2 cue-at-commit**: for an obvious prospect turn (`contentGuess === "customer"`)
  the cue clock starts at commit, not after the `/attribute` round-trip — removes
  the classifier latency from the common case, which is the founder's "very
  little or no delay" requirement.
- A new commit cancels a pending cue (`cueScheduledAtCommitRef` reset each commit)
  — no stale-ref leak, no double-fire across turns (traced).

**Flags**
- 🟡 **Cancel-on-disagree is best-effort, not a hard interlock.** *[accepted
  tradeoff — documented in-code this session]* It only wins when `/attribute`
  returns under `TURN_SETTLE_MS` (700ms); an LLM call usually exceeds that, so on
  the rare wrong high-precision content tell the early cue already went out. This
  is the irreducible latency↔accuracy cost of L2 — reducing it further means
  waiting on the LLM, re-adding the latency L2 removes. Minimized by the
  high-precision gate, self-correction (label settles), and `generateLiveCue`'s
  own §3.3 gate. Comment now states this truth so it isn't over-trusted.

---

## Layer C — Cue accuracy / helpfulness (grounding + the understanding gate)

Files: `liveCuePrompt.ts`, `liveCue.ts`.

**Solid**
- Cue is gated on the §3.2 understanding gate (read phase → decide → often stay
  silent) and the §3.3 guide-don't-overtake rule. Silence is sacred post-close.
- `generateLiveCue` **never throws** — every failure path returns a silent
  fallback, so a cue failure cannot disrupt a live call.
- **Grounding this session**: cues now reason from THIS company's methodology +
  product (the same 0074/0078 corpus the post-call review uses — one source,
  §A21), cached + compact so it adds no per-cue round-trip.

**Flags**
- 🟡 **`filler_spike` depends on the STT preserving disfluencies.** *[surfaced —
  needs a live-call check]* If ElevenLabs Scribe strips "um/uh", the trigger
  silently never fires. Known limitation, documented in `liveCuePrompt.ts`;
  other triggers unaffected. Cannot be verified in code.
- 🟢 **Empty grounding is cached for the full TTL.** If a company adds their
  corpus mid-session, cues won't ground for up to 5 min. Self-heals; caching the
  empty result is *correct* for corpus-less companies (avoids DB hammering).

---

## Layer D — Surface honesty (does the UI match what the system can do)

Files: `StartSessionPanel.tsx`, `LiveCoachingPanel.tsx`.

**Solid**
- Speaker-label + mic-meter copy is content-first (fixed earlier this arc): "leads
  by what's said; your voice and loudness help."
- **Video capture disclosure this session**: video mode now states the mic hears
  the rep's side only, not the prospect's far-end audio — the rep's mental model
  now matches reality (§3.4 / §1.5.1 layer-3).

**Flags** — none open at this layer after this session's fix. (An empty flag list
is itself suspicious per §1.7.3; the honest reason is that the two live-facing
copy gaps found this arc were both fixed — content-first copy and the video
disclosure. Re-examine when the video A/B changes what the surface must promise.)

---

## Open founder-gated decisions (not built — awaiting the call)

1. **Video A/B** — capture far-end call audio (`getDisplayMedia`) vs stay
   mic-only. Gates Layer-A flag #1.
2. **0083 manager read-set** — CEO/COO/admin only vs also `sales_coach_role='admin'`;
   then apply 0083.
3. **`filler_spike` live STT check** — confirm Scribe preserves disfluencies.
4. **Pitch-anchor UI nudge** — surface when the manual "I'm speaking" anchor would
   sharpen in-person separation.

---

*No finding here is a blocker (§1.7.5). The actual blockers remain §3.2 (the
understanding gate) and §7 (default deny). This record exists so the next audit
can be compared against it, and so the video A/B has a durable statement of what
the mic-only path does today.*
