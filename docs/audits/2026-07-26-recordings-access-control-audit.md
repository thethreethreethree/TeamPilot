# Sales-coach call recordings — access-control audit (§1.7), 2026-07-26

Outside-view stance (§1.3). Target: can one team fetch/serve another team's recorded sales call (IDOR on
sensitive PII), and can a user write/save/purge a recording they shouldn't. Fresh target (ELOSALES was
feature-audited 2026-07-21, not access-audited). **Result: SOUND on every vector.** No code changed.

## The load-bearing structural fact
**The recording AUDIO is never served.** `coaching_sessions.audio_asset_url` is WRITTEN by
`upload-recording`, FILTERED OUT of the list response, and NULLED/deleted by the purge cron — no route
signs or serves it, and no surface plays it (verified by grep: `createSignedUrl`/`signAssetUrl`/`.download`
never touch the recording path). So the classic "IDOR on the audio bytes" surface **does not exist** — you
can't leak an asset nothing serves. (This is the A31 "written, protected, purged, never read" observation;
already surfaced to the founder as ELOSALES OPEN ⑦ — the audit confirms it, doesn't re-raise it.)

## Route-by-route
| Route / op | Client | Gate | Verdict |
|---|---|---|---|
| `recordings` GET (list + metadata) | admin | query ALWAYS `company_id = <caller profile's company>` (`:91`, server-derived); cross-rep (`agentId != self`) requires `isSalesCoachManager` + `canManagerViewRepSkills` same-company (`:67,78`); returns metadata only, **not** `audio_asset_url` | No cross-tenant, no unauthorized-rep |
| `[id]/save-recording` POST | admin | tenant check `session.company_id !== companyId → 404` (`:55`, indistinguishable), then owner-or-manager | Sound |
| `[id]/upload-recording` POST | session→admin | `getSession(id)` is RLS-scoped (cross-tenant id → 404, `:66`); storage path company-prefixed with server-derived `companyId` (`:117`); admin update acts on the pre-authorized id | No cross-tenant write |
| `recording-purge-cron` | service | `CRON_SECRET` + `constantTimeEqual`, fail-closed (already verified in the 2026-07-26 RCD audit §2) | Sound |

## Purge-cron DELETION LOGIC (not just auth) — verified before founder activation (added 2026-07-26)
The recording-purge cron irreversibly deletes call-audio, so its logic was verified separately (parallel to
the RCD retention-cron check in `2026-07-26-rcd-security-audit.md` §2a). **Sound — and exemplary:**
- Only past-window, unsaved recordings: `created_at < cutoff` AND `recording_saved = false` AND
  `audio_asset_url is not null` (`recording-purge-cron/route.ts:43-45`). Recent + saved recordings safe.
- No misconfig mass-delete risk: `RETENTION_DAYS` is HARDCODED `2` (`:20`), not env-read — cannot be set to 0.
- **The malformed-pointer guard (`:56-72`) is the standout:** `remove()` on an unrecognized path returns NO
  error, so naively the cron would null the pointer + count it purged while the audio survives forever
  unreferenced (the "false-ok" deletion bug). It instead REFUSES to touch a row whose pointer isn't the
  shape it understands, flags `malformed`, and surfaces the count (§3.4) — exactly the right discipline in a
  deletion-promise cron.
- Byte-before-pointer ordering (remove object, then null pointer; failure leaves the row for retry);
  "already gone" converges; honest `bounded`. Safe to activate.

## Minor / defense-in-depth notes (not defects)
- `upload-recording`'s final `admin.update(...).eq("id", id)` has no `company_id` filter, but `id` is
  pre-authorized by the RLS-scoped `getSession(id)` above, so it's belt-without-suspenders, not a hole.
- Within-company a rep could in principle upload a recording onto a colleague's session if the
  `coaching_sessions` RLS lets members read each other's sessions — within-tenant only, low concern, not a
  cross-tenant or external exposure.
- Executable-extension block on upload (spoofable MIME defense-in-depth) is present.

## Verdict
No cross-team recording access (list is company-scoped + manager-gated; audio is never served), no
cross-tenant write (upload/save are session-authorized + tenant-checked), purge is auth'd. **Sound.**
