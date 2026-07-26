# Service-role (admin-client) tenant-scope sweep — §A26 capstone, 2026-07-26

Outside-view stance (§1.3). The common thread across this session's per-subsystem access audits (RCD,
files, recordings) is one invariant: **`createAdminClient()` bypasses RLS, so every admin-client DB
operation on tenant data must be scoped to the AUTHENTICATED caller's own company** — via an explicit
`.eq("company_id", <authed companyId>)`, a prior RLS/token authorization of any client-supplied id, or an
in-code ownership check that implies company scope. This doc sweeps that invariant across the WHOLE API
surface. **Result: no gap — every admin-client route is tenant-scoped.**

## Coverage
`createAdminClient` appears in ~40 API route files (47 matches incl. tests). Split:
- **~17 verified individually earlier this session** (read source directly): RCD ingest + retention-cron +
  read routes (`2026-07-26-rcd-security-audit.md`), recordings list/save/upload/purge
  (`2026-07-26-recordings-access-control-audit.md`), files serve/patch/delete/access + widget upload
  (`2026-07-26-files-access-control-audit.md`), the 6 care-extension tool routes (all via the centralized
  `guardExtensionRequest` → `user.companyId`, no drift), inbound-email (prior 2026-07-24 audit).
- **23 swept here** via a fan-out audit, each verdict tied to the exact admin read/write line + its scoping
  mechanism. All SAFE. The scoping mechanisms found: `.eq("company_id", ctx.companyId)` (tenant/logo,
  settings, tts, attribute, list, voice, team-analytics, coach-assessment, storage-sweep, files-suggestions);
  client id co-filtered by the caller's company (`.eq("id", body.id).eq("company_id", ctx.companyId)` —
  agents, team); prior RLS/token authorization of the id before the admin acts (messages, agent-upload,
  file/[fileId], tts-care, why, elo, product, corpus, notify-message); explicit ownership check
  (topic-lock `created_by`, file/[fileId] `linked_conversation_id` + `access_role`).

## §A38 — I spot-verified the two least-obvious conclusions myself (not relayed)
The two routes scoped by an **ownership check rather than a `company_id` column filter** are where a false
"safe" would most likely hide, so I read them directly:
- **`chat/topics/[id]/lock`** — admin reads `chat_topics.eq("id", id)` with no company filter, but
  `topic.created_by !== auth.user.id → 403` (`:55`) gates it. A user's id can only be `created_by` on a
  topic they created, which is in their own company → the ownership check IS a tenant scope. **Confirmed
  safe.** (Theoretical edge: a user moved between companies could lock a topic they created in the old one —
  within-membership, not a cross-tenant data leak; negligible.)
- **`care/conversations/[id]/file/[fileId]`** — customer/token path; admin reads the file by id but returns
  null unless `linked_conversation_id === <the x-care-session-authorized conversation>` (`:82`) AND
  `access_role === 'everyone'` (`:87`). No cross-conversation/cross-tenant file leak. **Confirmed safe.**

## Verdict
No IDOR / cross-tenant gap in the service-role route surface. The admin client is used deliberately (to
serve customers with no `auth.users` row, or to enforce a STRONGER authorization than RLS allowed), and in
every case the tenant boundary is re-established in code before the operation. **Sound.** This is a
point-in-time sweep (§1.7.4); the invariant to preserve on any NEW admin-client route: scope it to the
authed caller's company, never to a client-supplied id/company without first authorizing it.
