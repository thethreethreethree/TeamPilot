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
