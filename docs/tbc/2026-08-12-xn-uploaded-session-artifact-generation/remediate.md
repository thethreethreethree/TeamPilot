# REMEDIATE — F1 uploaded-recording sessions generate the summary

## F1 — uploaded path now triggers the same generation as the live path
Root cause: the post-call artifacts (summary/dissect/pivot/moments/intel) are generated only by the
`runAndStore*` engines, invoked from `/finalize` (live sessions, on Stop) and the manual `/summarize` POST.
The uploaded-recording flow (`/upload-recording` → `/label-transcript`) appends a transcript but never invoked
either, so uploaded sessions had a transcript and no summary.

Remediation:
1. Extracted `/finalize`'s five-engine generation block, verbatim, into a shared
   `src/lib/coach/v5/generateSessionArtifacts.ts` (A16 — one definition, no drift).
2. `/finalize` now calls the helper (behavior-identical; live flow unchanged).
3. `/label-transcript`, after appending the labeled transcript, reads the full transcript (request scope) and
   schedules `generateSessionArtifacts` via `after()` (post-response, server-side). Added `maxDuration = 60`.
   Gated on `appended > 0` (only a fresh label; the 409 guard blocks re-labels → no double-generation) AND a
   non-null `companyId` (never runs ungated — the §3.4/§A21 control gate).

Tests added (label-transcript route):
- generation fires with `{companyId, actorId, sessionId}` + the read-back transcript as `segments`;
- generation does NOT fire on the 409 already-has-transcript path (nothing appended);
- generation does NOT fire when `getCurrentCompanyId()` is null (the transcript still saves).

Outcome: fixed. Uploaded-recording sessions now produce the identical artifact set live sessions get, so the
Conversation-summary surface + the Sessions "Summary" badge populate for them.

## F2 — the generation-scheduling code could 500 a label whose transcript already saved (found in post-ship adversarial self-review)
Found reviewing F1's own change (the guard's verification allowance): the post-append block read
`getCurrentCompanyId()` and `getSessionTranscript(id)` UNGUARDED before returning 200. `getSessionTranscript`
rethrows a DB read error by contract (INV22 / §3.4 — no error-as-no-data), and both run AFTER the append
already succeeded. So a transient read error there would 500 a label whose transcript is saved — and the rep's
retry would then hit the 409 already-has-transcript guard, a HARD TRAP. F1's own comment promised generation
"never fails the label", but the scheduling half broke that promise.

Remediation: wrapped the ENTIRE scheduling block (companyId lookup + transcript read + after() scheduling) in
try/catch, logging and swallowing any error. The append is the load-bearing result; generation is a bonus a
re-summarize / the backfill cron can still supply. Added a test: label-transcript returns 200 with the correct
`{appended, requested}` even when the post-append transcript read throws (and generation is not called).

Outcome: fixed. severity: medium (a transient DB blip could trap a rep mid-upload); class: "best-effort
follow-on work that can throw before the load-bearing response, turning a bonus failure into a primary
failure". This is the SECOND instance in this build of "the append is the truth; everything after is
best-effort" — both now honored.
