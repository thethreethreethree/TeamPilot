# Amendments to the Constitution

The constitution at [`CLAUDE.md`](../../CLAUDE.md) is the project's operating law. It can evolve, but not casually — evolution must be **earned**, the same way the constitution itself demands every diagnosis be earned.

This folder is the append-only record of every proposed change to the constitution: ratified, denied, or deferred. It exists so that:

- The constitution's *current* text is one thing, and the *reasoning behind every change* is preserved separately. Per **Rule 3.1**, the audit trail is immutable; the text is derived.
- A confident-sounding amendment that wasn't earned can be rejected on the record, and the rejection itself becomes an asset (Rule 1.1).
- A future builder under pressure (Rule 5) cannot quietly soften the constitution. Every change has a paper trail of *why*.

## Format

One markdown file per proposal, named `AMD-XXX-short-slug.md`. Sequential, never renumbered. See [`AMD-001-establish-process.md`](AMD-001-establish-process.md) for the canonical template.

Required sections:

| Section | Purpose |
|---|---|
| **Trigger** | The specific incidents, from the actual record, that surfaced the friction with the existing rule. ≥1 incident required (bootstrap exception below). |
| **Diagnosis** | *Why* the existing rule produced wrong behavior. Not what to change — why what's there is wrong. (Rule 0, Rule 2 "diagnose before patching".) |
| **Ripple-trace** | Every other section/rule of the constitution this proposal affects, and confirmation that coherence is preserved. (Rule 1.5 holistic.) |
| **Alternative-test** | Evidence the proposed rule produces a better outcome than the existing rule on the triggering incidents. Where the change is structural and pre-incident, state explicitly. (Rule 4.) |
| **Outside-view check** | A second reading from a stance with no investment in the proposed change. (Rule 1.3.) |
| **Proposed change** | The exact diff to CLAUDE.md text. |
| **Decision** | `ratified` \| `denied` \| `deferred`, with the reason. |

## Soundness gate (default deny)

A proposal is ratified ONLY if every check below passes. Any failure → denied. Denial is not weakening — it is the constitution doing its job.

- [ ] Trigger cites ≥1 incident from the record (bootstrap exception: AMD-001 only)
- [ ] Diagnosis explains *why*, not just *what to change*
- [ ] Ripple-trace enumerates affected sections; no silent contradictions introduced
- [ ] Alternative-test shows the proposed rule outperforms the existing rule on the triggering incidents, OR explicitly identifies as structural-gap-filling with no precedent to test against
- [ ] Outside-view check applied; the proposal survives a reading by someone with no stake in it
- [ ] The proposal does not loosen the constitution for the convenience of the builder under pressure (Rule 5)

## Lifecycle

1. **Proposed** — file written, status `proposed`, sections drafted but soundness gate not yet evaluated.
2. **Reviewed** — soundness gate run; result recorded in `Decision`.
3. **Ratified** — `CLAUDE.md` is edited to reflect the change. The amendment file is marked `ratified` and is now part of the canonical record.
4. **Denied** — `CLAUDE.md` is untouched. The amendment file stays in this folder forever as evidence of what the constitution rejected and why.
5. **Deferred** — incomplete or premature. Returns to `proposed` after more evidence is gathered. Never silently dropped.

## Files are append-only

Once an amendment file is written, **its text is not edited**. Status is updated by appending a `## Status Update` section at the bottom. Git history is the integrity check. This mirrors Rule 3.1 — events are immutable; state is derived by replay.

## Index

| ID | Title | Status | Date |
|---|---|---|---|
| [AMD-001](AMD-001-establish-process.md) | Establish the amendment process | ratified | 2026-05-16 |
| [AMD-002](AMD-002-understanding-gate-defaults.md) | Ratify Understanding Gate default thresholds (3 / 2 / 80) | ratified | 2026-05-16 |
| [AMD-003](AMD-003-per-company-brain.md) | Per-company brain as the §3.4 implementation (DeepSeek primary) | ratified | 2026-05-16 |
| [AMD-004](AMD-004-ground-up-audit.md) | Ground-up audit as a constitutional practice (§1.7) | ratified | 2026-06-02 |
