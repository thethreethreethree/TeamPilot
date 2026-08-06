# Audit record — 2026-08-06: reasoning-model outage + the 0208 data-loss incident

On-record trail (§1.7.4) for the two significant events of 2026-08-06, so a later audit compares against this
baseline. All code is on `main`, CI-green, deployed (live `build.commit` walked 16efcdd0 → … → 0222f7cd).

## Headline
A **2-week customer-facing outage** (Sales Coach "Your read" blank on every call since ~2026-07-30) was
root-caused, fixed across all three of its dimensions, verified against production data, and guarded against
recurrence. Separately, while building the (unrelated) transcript dedup, **I caused a data-loss incident**
(`0208`) — 132 rows deleted by a `db:verify` that a migration's inline `commit;` defeated — now guarded.

## Event 1 — the reasoning-model outage (client escalation)
**Trigger.** Founder escalated a frustrated client: a real 9-minute call showed nothing on "Your read".

**Root cause (reproduced live, not assumed).** The 2026-07-25 model rename made `deepseek-v4-flash` — a
REASONING model — the active LLM. It spends completion tokens *thinking* before emitting content. It hurt the
coach in TWO ways, both of which had to be fixed:
1. **Token starvation.** Reasoning (1300–2620 tokens on the real ~9k review prompt) consumed the whole budget
   → `finish_reason:"length"` with EMPTY content → parse fail → blank. A prior "fix" (256-token headroom,
   `8ec3a20e`) was calibrated on *trivial* tasks and under-covered it — the reason it "kept recurring".
2. **Latency.** The model is slow (15–40s/engine); the multi-engine routes degraded each engine to EMPTY at
   a 25s `CALL_TIMEOUT`, and the sequential backfill blew its 60s `maxDuration`.

**Fix (all live, verified).**
- Headroom `REASONING_HEADROOM_TOKENS` 256 → **3500** at the provider chokepoint — covers every engine/caller;
  measured against the *real* ~9k prompt (`229d568b`, `40679d10`). Floor-guarded (`52c86054`), and the provider
  now logs loudly on empty+`finish_reason:length` so it can never go silent again.
- Timeouts 25s → **40s** in finalize + summarize (`0222f7cd`); dissect backfill **parallelized** (`5d6c086a`)
  — so slow reasoning runs COMPLETE instead of degrading, and the auto-heal + "Generate missing" actually work.
- Past reads **auto-heal** on view (`7d65266f`); new calls work from the start.

**Scope (verified with data).** CARE customer replies UNaffected (0 empties in the window — smaller prompt +
Anthropic failover). Single-LLM-call routes adequate at 60s. The client's own session (`9e783ea6`) has an
intact transcript and heals cleanly. Latency-*usability* on the real-time paths (live cues, voice) is a
slow-but-correct tradeoff → flagged as a vendor/model-routing decision (and currently uninstrumented → cue
latency is unmeasurable from data: 0/81 cues carry `latencyMs`).

**Corrections I made openly along the way** (each surfaced, not hidden): mis-targeted the dissect engine
(narrative is `debriefCoachV5`); under-measured the headroom twice (measured a tiny prompt, then a bigger one);
mis-stated the repopulation path ("Generate missing" is right for the *manager view + ELO*, not the narrative).

## Event 2 — the 0208 data-loss incident (I caused it)
While building the founder-approved transcript dedup, migration `0208` carried an inline `begin;…commit;`.
`db:verify` proves migrations via `begin → sql → rollback`, but the inline `commit;` finalized the work before
the outer rollback — the "dry run" silently COMMITTED, deleting **132 real take-segments** and adding a wrong
`unique(session_id,seq)` constraint (bounded to the 13 already-corrupted Frankenstein sessions). Reproduced on
a scratch table (commit-free rolls back; with-commit persists). **Guarded** (`dc4b50f5`): `db-apply` now rejects
statement-level `begin;`/`commit;`/`rollback;` in both verify and apply paths. The append-only rule was
restored by 0208, so the constitutional guarantee held (verify:live still passes). **Two founder decisions
remain** (top of the queue): session/take model (keep or drop the constraint) + PITR recovery.

## Lessons (for the next audit)
- **Measure against production reality, not a convenient approximation.** The 256 headroom (trivial-task probe)
  and my first 1500 (tiny-prompt measure) both looked right and under-covered production. Reproduce with the
  ACTUAL prompt size. [[reference_reasoning_model_token_starvation]]
- **A reasoning model degrades correctness in TWO ways** — token budget AND latency/timeouts. Fixing one is
  not fixing the class.
- **Never put `begin;`/`commit;` in a migration** — it defeats `db:verify`'s rollback (now guarded).
- **Verify before claiming, and reproduce the ACTUAL failing artifact** — my scratch test that "proved
  db:verify safe" used a commit-free migration; the real repro needed the commit.
