# REMEDIATE — atomic-replace + hardening fixes

## F1 — atomic transcript replace (delete+insert in one transaction)
Remediation: `replace_session_transcript` RPC (0212) replaces a session's transcript in ONE transaction, so a
mid-write failure rolls the delete back with it — the original is never destroyed-and-unreplaced. Both
/auto-recover and /label-transcript's overwrite branch call it; each returns 500 (never a false "recovered"/200)
on `!ok`, with the original intact.
gate: `auto-recover/route.test.ts` "500 with NO false 'recovered' when the atomic replace fails"; the
"RECOVERS…" test asserts the atomic replace is called with the labeled segments (not a delete-then-append);
`label-transcript/route.test.ts` "500 and NO false success when the atomic replace…fails". class: data-integrity
/ honesty. severity: high. Fixed.

## F2 — shared latch so the heal doesn't fire alongside auto-recover
Remediation: the heal `else-if` also requires `autoRecoverAttemptedFor.current !== id`, so the mode-reconcile
second `load()` can't fall into an LLM re-gen on the same one-sided transcript.
gate: covered at the pure-predicate boundary + the shared-latch condition (the page effect has no render
harness, consistent with the existing autoGen latch). class: waste/KPI. severity: medium. Fixed.

## F3 — cross-match separation guard
Remediation: cross-match decides only when the runner-up is below the similarity floor; two clusters both
clearing it → decline. A polluted known-agent set (both clusters overlap) can no longer drive a confident
inverted label.
gate: `autoSpeakerAssign.test.ts` "DECLINES when TWO distinct clusters both clear the similarity floor". class:
mis-attribution. severity: medium. Fixed.

## F4 — release the marker on transient failure
Remediation: `releaseMarker()` resets `auto_recover_attempted_at` to null on the download/diarization 502 paths,
so a transient infra failure doesn't permanently disable automatic retry; a definitive outcome keeps it set.
gate: `auto-recover/route.test.ts` "releases the marker on a transient diarization failure". class: availability.
severity: low. Fixed.

## F5 — skip auto-recover for video sessions
Remediation: the page trigger is gated on `!isVideoSession` (`context === "video"`), so a video session (mic is
agent-only by design) never claims the marker or spends STT on a guaranteed decline.
gate: the trigger condition (`!isVideoSession && afterPitchNeedsAutoRecover(...)`). class: cost. severity: low.
Fixed.

## Honesty note
All five are defects the adversarial review found in the auto-recover feature I shipped earlier the same day.
F1 (HIGH) is the one that mattered: an automatic, no-tap path that could destroy a real agent transcript. The
founder chose the transactional RPC — the root fix, applied to both overwrite paths, so the delete-then-append
class that has now bitten twice cannot recur.
