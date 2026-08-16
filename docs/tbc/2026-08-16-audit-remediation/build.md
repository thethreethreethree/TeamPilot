# BUILD — 2026-08-16 audit remediation

### #1 — live-coaching banner tells the truth (HIGH, §3.4)
read-path: `useLiveCoaching.ts` gains an `audioCapturing` state set true only after `rec.start()` and false in
the recorder `onstop` + at session start — so it reflects whether the MediaRecorder is actually capturing.
write-path: `notRecordingBanner()` (new pure fn, `src/components/sales-coach/notRecordingBanner.ts`) drives the
banner copy: STT-error WHILE capturing → "your audio is still recording" (never "nothing is being captured");
only a real stop (mic-denied, `stop()` ran) says capture stopped. `LiveCoachingPanel.tsx` consumes it. Unit-tested.

### #2 — ask-coach fences the transcript + INV25 closes the guard gap (MED, prompt injection)
read-path: `ask-coach/route.ts` appends `CONVERSATION_IS_DATA` to its system prompt (the transcript carries
customer speech = untrusted text).
write-path: **INVARIANT 25** (`scripts/invariant-audit.mjs`) fails any coach API route that pulls a transcript
(`getSessionTranscript`) AND calls an LLM directly (`generateCareReply`/`llmCall`/`llmStream`) without the fence —
the blind spot INV23/24 (engine-dir-scoped) left open. Detection tamper-tested.

### #3 — monitoring audit fails loud (MED, accountability)
read-path: `logMonitoringAccess` now logs failures and returns a boolean (was a silent `catch {}`).
write-path: the session-detail route (`admin/monitoring/session/[id]/route.ts`) returns 503 and does NOT serve
the transcript when the audit write didn't land — an unaudited cross-tenant read is worse than a retryable 503.

### #4 — monitoring allowlist boundary is tested (was untested)
read-path: `src/lib/monitoring/__tests__/vendorMonitoring.test.ts` (new) drives the real data layer with a fake
admin client.
write-path: asserts an off-allowlist company yields null/[] AND `getMonitoredSession` never queries
`coaching_transcript_segments` in that case — a future reorder/drop of the gate reddens here.

### #5 — forced cue surfaces an error honestly (LOW)
read-path: `liveCue.ts` catch rethrows when `args.force` (auto path still returns `silent`).
write-path: `cue/route.ts` catches a forced-cue throw → 502; the client already renders `!res.ok` as "Cue request
failed", so a real failure no longer masquerades as "Coach had nothing to add".

### #6 — invite share links use the canonical origin (LOW)
read-path: `siteUrl()` (client-safe, prod fallback).
write-path: `team/page.tsx` + `InviteMemberDialog.tsx` build `${siteUrl()}/invite/<code>` instead of
`window.location.origin` — same origin-drift class as the recovery-redirect bug.

### #7 — vendor-company-id drift guard (LOW)
read-path: `src/lib/crm/__tests__/vendorCompanyId.sync.test.ts` (new) reads the 0089 migration.
write-path: asserts the `is_vendor_super_admin()` hardcoded UUID equals `VENDOR_COMPANY_ID` — the DB gate and the
route gate can't silently diverge.

## Deferred
- **#8 ESLint toolchain bump** — `eslint-config-next` 15→16 changes lint rules; can surface new errors that break
  `npm run lint`/Vercel (framework-bump trap). Flagged for a dedicated verify cycle, not batched here.
