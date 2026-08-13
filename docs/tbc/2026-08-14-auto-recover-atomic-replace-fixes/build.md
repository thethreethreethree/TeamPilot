# BUILD — atomic-replace + 4 hardening fixes

### replace_session_transcript RPC (migration 0212) — the atomic overwrite
read-path: `supabase/migrations/0212_replace_session_transcript_rpc.sql`.
write-path: a SECURITY DEFINER plpgsql function (pinned search_path) that `delete`s all of a session's segments
then `insert`s the new set from a jsonb array, in ONE transaction. EXECUTE granted to service_role only
(revoked from public/anon/authenticated) — not client-callable.

### replaceSessionTranscript (data layer)
read-path: `src/lib/data/salesCoach.ts` — `replaceSessionTranscript(sessionId, segments)`.
write-path: calls the RPC via the service-role client; returns `{ ok, count }`. `ok:false` means nothing
changed (the original stands). Used for every RECOVERY OVERWRITE instead of a delete-then-append pair.

### auto-recover: atomic overwrite + honest status + marker release (① ④)
read-path: `src/app/api/coach/sales-session/[id]/auto-recover/route.ts`.
write-path: on a confident assignment, `replaceSessionTranscript(id, labeled)`; returns `recovered` only when
`ok`, else `failed` (500) with the original intact. On a transient STT/download 502 it releases the marker
(sets `auto_recover_attempted_at` back to null) so automatic retry isn't permanently burned.

### label-transcript: overwrite branch uses the atomic replace (① root)
read-path: `src/app/api/coach/sales-session/[id]/label-transcript/route.ts`.
write-path: the FIRST label of an empty transcript keeps the 23505-idempotent append (concurrent double-label
stays a safe no-op); the OVERWRITE of a 0-agent transcript now uses `replaceSessionTranscript` (atomic), 500 on
failure with the original preserved.

### autoSpeakerAssign: cross-match separation guard (③)
read-path: `src/lib/coach/v5/autoSpeakerAssign.ts`.
write-path: none (pure). Cross-match decides only when the winner clears the floor AND the runner-up is below
it; two clusters both clearing → decline (fall to content-tell / manual tap), so a polluted-known-agent set
can't drive an inverted label.

### after-pitch page: shared latch + video gate (② ⑤)
read-path: `src/app/dashboard/sales-coach/[id]/after-pitch/page.tsx`.
write-path: the heal `else-if` also checks `autoRecoverAttemptedFor.current !== id` (no double-fire on the mode
reconcile); auto-recover is skipped when `context === "video"` (agent-only mic → nothing to recover).

## Test coverage
- `autoSpeakerAssign.test.ts` (10): + the two-clusters-both-clear-the-floor → decline (③) case; cross-match win
  re-cased with a non-echoing customer so it exercises a clean, separated cross-match.
- `auto-recover/route.test.ts` (12): recovered → ATOMIC replace called with labeled segments; replace fails →
  500 + status `failed` (no false recovered); transient diarization failure → 502 + nothing saved (marker
  release path). could-not-decide / still-one-sided → replace NOT called.
- `label-transcript/route.test.ts`: overwrite → atomic replace (append NOT called); replace fails → 500 +
  original preserved; first-label still uses the 23505-idempotent append.
