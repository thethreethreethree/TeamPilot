---
started_at: 2026-09-04T03:44:00+08:00
---

# THINK — Weekly manager digest (email)

## Why (founder pick over rep digest / both)
The founder chose a weekly MANAGER team digest — the companion to the now-live NotificationBell alerts: instant
pings for events, a weekly email rollup for the picture. Each manager gets their team's last-7-days summary (points,
strong sessions, deals, top performers) so a manager who doesn't open the app daily still sees the shape of the week.

## Understanding (from the code, §0)
- Email seam = `src/lib/care/email/outbound.ts` (Postmark). It only had a conversation-REPLY sender; a digest needs a
  GENERIC send → added `sendTransactionalEmail` (HTML + text) reusing the same token/domain + header sanitizer.
- Cron pattern = the sibling coach crons (GET, CRON_SECRET Bearer via constantTimeEqual, maxDuration). vercel.json
  registers them; the invariant audit fails a cron route that isn't registered — so the new cron is added there.
- Manager emails live in `auth.users` (profiles has no email col — probed live); resolved per manager via
  `admin.auth.admin.getUserById`. Managers = `isAdminRole(role) || sales_coach_role='admin'` (the shared predicate).
- Content reuses the SAME source the board reads (the ledger + sold sessions) so the numbers agree; the strong
  threshold + admin predicate come from the shared modules (no re-derivation).

## The build
- `sendTransactionalEmail` (outbound.ts): generic Postmark send; fails SAFE + LOUD when unconfigured.
- `weeklyDigest.ts`: `summarizeTeamWeek` (PURE fold of a week's ledger + deals → per-team summary) +
  `renderManagerDigestEmail` (PURE subject/HTML/text, inline-styled light email, HTML-escaped names) +
  `runWeeklyManagerDigest` (orchestrator: per active company → summarize → email each manager; injectable send/now).
- Cron `/api/coach/gamification/weekly-digest-cron` (CRON_SECRET-gated, maxDuration 300) + a vercel.json entry
  (Mon 13:00 UTC). Server-only base URL via `APP_BASE_URL` (documented in .env.example; NOT NEXT_PUBLIC_).

## External-config completeness (§1.5.3)
Sending depends on Postmark (POSTMARK_SERVER_TOKEN + CARE_EMAIL_HOST_DOMAIN + a verified From domain) + CRON_SECRET.
The run returns `emailConfigured` + logs a warn when Postmark is missing (fail-loud, not silent); the cron 503s
without CRON_SECRET. Live sending is confirmed on deploy (the sandbox can't send). C.A.R.E email is already live, so
Postmark is likely configured — flagged either way.

## Out of scope
The rep progress digest + a "both" option (the founder picked manager-only). An opt-out preference (default-on for
the few managers; a toggle is a follow-up).

## Session-read manifest (A22 — read_at >= started_at 03:44 2026-09-04)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-04T03:56:00+08:00",
    "why_it_governs": "Understanding precedes solving — I traced the email seam, the cron pattern, and the (auth.users) email source from the code before designing, rather than assuming a generic sender existed.",
    "how_this_build_will_embody_it": "The generic sender was ADDED because the code only had a reply sender; the recipient query joins auth.users because profiles has no email." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-04T03:56:10+08:00",
    "why_it_governs": "The methodology doc must be in the tree + read this session.",
    "how_this_build_will_embody_it": "THINK-BUILD-CHECK-PROMPTS.md present; CLAUDE.md sections re-consulted this build." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-04T03:56:20+08:00",
    "why_it_governs": "Layer-2 effectivity — a digest whose numbers or send silently fail isn't 'working'.",
    "how_this_build_will_embody_it": "Pure summary/template are unit-tested; the send fails loud when unconfigured; the email was rendered + read by eye." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-04T03:56:30+08:00",
    "why_it_governs": "Reuse the repo's seams (email, cron, RLS, shared constants), don't template new ones.",
    "how_this_build_will_embody_it": "Reused the Postmark seam + the cron+CRON_SECRET pattern + the ledger source + the shared strong-threshold/admin predicate." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-198", "read_at": "2026-09-04T03:56:40+08:00",
    "why_it_governs": "The feature depends on config outside the code (Postmark token/domain/From, CRON_SECRET) — the external-config-completeness class.",
    "how_this_build_will_embody_it": "Returns emailConfigured + logs a warn when Postmark is missing (fail-loud); 503s without CRON_SECRET; live send confirmed on deploy." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-04T03:56:50+08:00",
    "why_it_governs": "Quick-decision checklist (reuse, external-config, verify, fail safe).",
    "how_this_build_will_embody_it": "Reused seams, flagged the Postmark precondition, verified pure logic + the rendered email, kept scope to manager-only." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-04T03:57:20+08:00",
    "why_it_governs": "Methodology in the tree, read this session — not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this build before citing them." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-640", "read_at": "2026-09-04T03:58:00+08:00",
    "why_it_governs": "Cite only assets re-read this session; the manifest is the proof.",
    "how_this_build_will_embody_it": "Each entry carries an in-session read_at; the commit carries the Session-Reads trailer." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-04T03:57:40+08:00",
    "why_it_governs": "A lesson in prose returns; the fix must be a GATE — the digest logic + cron gate must be test-pinned.",
    "how_this_build_will_embody_it": "8 pure tests (summary aggregation, top ranking, deals, HTML escaping) + 4 cron-auth tests pin the behavior." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-04T03:57:50+08:00",
    "why_it_governs": "'Verified' names the command + evidence; mark what could NOT be run.",
    "how_this_build_will_embody_it": "check.md pastes typecheck / the tests / invariant:audit(0) and names the live Postmark send as verified-on-deploy." }
]
```
