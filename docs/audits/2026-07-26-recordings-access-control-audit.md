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
