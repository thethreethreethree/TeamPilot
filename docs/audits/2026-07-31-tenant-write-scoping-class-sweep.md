# Audit — service-role tenant-write scoping, whole API surface (2026-07-31)

**Trigger.** While testing the Sales Coach `upload-recording` route I found its service-role
(`createAdminClient`) write to `coaching_sessions.audio_asset_url` scoped by session `id`
only, while the sibling `save-recording` scoped the same write by `id` AND `company_id`.
A service-role write bypasses RLS, so an `id`-only scope is tenant-safe only if some
*upstream* step already proved company access. "A bug rarely lives alone" (constitution
1.5.2) — so I swept the class across the whole API: every non-cron route that does an
admin/service-role `.update()`/`.delete()`, asking "is the row scoped to the caller's tenant,
or made safe by a verified upstream gate on a NON-user-supplied id?"

**Class definition.** The risk is an admin (RLS-bypassing) write whose target id is
*user-supplied* and whose only tenant protection is `.eq("id", <userInput>)`. RLS-scoped
(`createClient`) writes, and admin writes on *server-generated* ids, are different (weaker or
no) risk and are noted as such.

## Findings

| Route | Admin write scope | Verdict |
|---|---|---|
| `sales-session/[id]/upload-recording` | was `.eq("id")` only | **FIXED** → added `.eq("company_id", companyId)` (commit 8d54db32). Was safe via the upstream `getSession()` RLS read, but now tenant-safe on its own. |
| `sales-session/[id]/save-recording` | `.eq("id").eq("company_id")` | ✅ already scoped (the sibling that set the pattern) |
| `sales-session/team` | `.eq("id").eq("company_id", ctx.companyId)` | ✅ company-scoped |
| `sales-session/recording-purge-cron` | `.eq("id", row.id)` | ✅ correct — CRON_SECRET system job, selects expired rows across ALL tenants (`.lt("created_at", cutoff)`, no user input); `row.id` is from its own trusted query. A company filter would be wrong. |
| `care/agent/settings/agents` | `.eq("id").eq("company_id", ctx.companyId)` | ✅ company-scoped |
| `care/agent/tenant/logo` | `.eq("company_id", auth.companyId)` | ✅ company-scoped (not id-keyed) |
| `care/agent/conversations/[id]/messages` | `.eq("id", args.messageId)` | ✅ safe — `messageId` is the server-inserted `msg.id` in a conversation already company-gated (`detail.conversation.companyId !== auth.companyId → 403`), NOT user-supplied; a trigger further limits the write to coach-grade columns. |
| `care/inbound/email` | `.eq("id", args.conversationId)` | ✅ safe — `conversationId` is resolved server-side from the verified tenant mapping (tenant-scoped select / fresh insert), never from email content or LLM tool output. System webhook. |
| `chat/topics/[id]/lock` | `.eq("id", id)` | ✅ safe — gated by an ownership check (`topic.created_by !== auth.user.id → 403`), a per-user-identity gate stronger than company scoping. |
| `files/[id]` DELETE | `.eq("id", id)` | ✅ safe — explicit `isUploader || (isAdmin && sameCompany)` gate before the write, plus `.select()` rowcount verification (no silent no-op). |
| `files/[id]/access` DELETE | `.eq("file_id", id).eq("profile_id", …)` | ✅ RLS-scoped client (`createClient`), not admin — different (RLS-protected) class. Flagged by grep only because the file's POST/GET import admin. |
| `team` | `.eq("id",…).eq("company_id", c.companyId)` | ✅ company-scoped throughout |

## Conclusion

**One real gap (`upload-recording`), now fixed. Every other admin/service-role tenant-write
on the API surface is correctly scoped** — by `company_id`, by an explicit ownership/role gate
on the fetched row, by a per-user-identity gate, or (for the purge cron) intentionally
system-wide over a trusted internal query. The class is clean.

**Reusable lens for future routes:** an admin (`createAdminClient` / service-role) write whose
`.eq()` uses a user-supplied id MUST either pin `company_id`, or be preceded by an explicit
authorization read of that row (uploader/creator/role) — never rely on RLS alone, because the
admin client bypasses it. Prefer pinning `company_id` even when an upstream RLS read already
gates access, so the write stays tenant-safe independently of how that upstream read evolves.
