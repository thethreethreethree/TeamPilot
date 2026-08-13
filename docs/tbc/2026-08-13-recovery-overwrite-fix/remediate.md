# REMEDIATE — recovery overwrite fix

## F1 — the recovery stopgap couldn't save (label-transcript 409'd on any existing transcript)
Root cause: `label-transcript` refused (409 "already has a transcript") whenever `getSessionTranscript(id)`
returned any rows, on the assumption (its own comment) that "the recovery re-transcribe only fires when the
transcript is empty." My `BlankReadRecovery` stopgap broke that assumption: it renders for one-sided sessions,
which HAVE segments (customer/`unknown`) but a blank read. So the affordance showed, the agent re-transcribed +
named the speaker, and the save 409'd — recovering nothing. Caught by self-verifying my own shipped code.

Remediation: gate the 409 on AGENT TURNS, not existence.
- Existing transcript has ≥1 agent segment → CANONICAL (produces a real "Your read") → 409, never clobbered.
- Existing has segments but 0 agent turns → BROKEN read (one-sided / all-`unknown`), not canonical → delete via
  the new `deleteSessionTranscriptSegments` (so the re-diarized segments don't 23505-collide), then save the
  corrected transcript. Narrow, gated exception to append-only (§3.1, the append-only rule); owner-only unchanged.
Corrected the stale header comment ("nothing is mutated") + the inline TOCTOU comment ("recovery only fires when
empty") so they describe the exception (F5 don't-mislead discipline). Test covers both branches.
class: nonfunctional-affordance. severity: high. Fixed.

## Honesty note
This fixes a feature I shipped live and described as working, when it wasn't. Surfaced the break to the founder
before fixing (§2/§5); the founder chose "fix it" (overwrite a 0-agent-turns transcript) over "revert".
