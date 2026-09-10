# CHECK - a recovery that succeeds and costs something must say what it cost

## Findings

### F1 - a recovery that dropped the timing reported itself as a plain success
class: partial-result-reported-as-whole (a caller receives a success and a count, and cannot tell that part of the write was silently discarded)
sweep: grep -rn "TIMING LOST|timing_lost|spokenAt" over transcriptRecovery.ts and transcriptRecoverySweep.ts, then follow the RecoveryOutcome type to every caller
severity: high

The detection already existed and is careful - it reads the write back rather than trusting the
RPC's return count, because `replace_session_transcript` pre-0249 selects a literal null and still
succeeds. What did not exist was any route from that detection to a person. It went to
`console.error` and to an `events` row; the caller received `{ status: "recovered", appended,
source }`, identical in every field to a recovery that kept its timing.

Measured on production rather than inferred: three `coach.transcript_recovery_timing_lost` rows, at
2026-09-10T09:21:05, 09:21:51 and 09:22:06, every one `reason: "rpc-pre-0249"`. The
`_agent_migrations` ledger's newest entry is `0248_door_home_screen_sale_value.sql`, so the
condition is still live as this is written.

### F2 - the loss is permanent, which is correct, and is what makes the silence worse
class: irreversible-by-design (a deliberate non-retry that is right, paired with a report that hides it)
sweep: read the marker-release comment in recoverSessionTranscript and confirm no path clears auto_recover_attempted_at on a timing-lost recovery
severity: medium

The marker is deliberately not released: re-running would spend a transcription every hour on every
affected session for a condition only a migration can clear. I agree with that decision and did not
change it. But it means these calls are not coming back around - nothing will revisit them - so the
one moment anybody could have been told is the moment it happened, and that moment passed in
silence three times.

### F3 - the on-open web trigger does not match the justification written for it
class: rationale-does-not-match-behaviour (an exemption argued from a human choice the implementation never offers)
sweep: grep -rn "autoRecover" over the after-pitch page and read where it is called from
severity: medium

The sweep's own comment exempts the interactive path: "ONLY THE UNATTENDED SWEEP WAITS. A rep
opening a call and triggering recovery is a human choosing to have their words back now." But
`autoRecover()` is called from `load()`, on page load. No choice is presented to anybody. Three
events inside sixty-one seconds is what a page load looks like, not three decisions.

NOT FIXED HERE, deliberately. Changing when a rep's call is recovered changes what reps experience,
and the trade - words now against timing later - is the founder's to make. It goes to them with the
measurement attached. The mobile button added on 2026-09-11 IS an explicit tap and fits the stated
rationale exactly, so it is left as it is.

## What I got wrong in this build

I began by treating the missing migration gate on the interactive path as an oversight, and was
part-way into gating it when I read the sweep's comment and found it documented as a decision. The
finding is real, but it is a mismatch between a rationale and an implementation, not a missing
guard - and had I not opened the file I would have "fixed" a deliberate choice and reported it as a
defect. Recorded because the correction is the useful half.

## Verification

  $ npx tsc --noEmit
  exit 0

  $ npm run tbc
  exit 0
