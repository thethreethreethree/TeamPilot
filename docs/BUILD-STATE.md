# BUILD-STATE — durable unfinished-work + risks ledger

> **READ THIS FIRST ON RESUME.** If a build was interrupted (founder paused, internet dropped,
> context compacted, machine died), this is the single file that says *exactly* what was mid-flight,
> what is done, what is NOT done, and the risk of each unfinished item. It is maintained *during*
> every build — not written at the end — so it is never more than one step stale.
>
> **Invariant:** an item is only "done" when it has evidence (a grep / test / read-path you can point
> to, A38). "Reported done while partial" — the recurring failure this ledger exists to kill — is
> structurally impossible if every requested item lives here with an honest disposition.
>
> Companion mechanism: each *revision* build also carries `docs/tbc/<dir>/revision.md` (every atomic
> requested change → a tracked disposition), enforced at closure by `npm run tbc:revision`.

---

## ▶ ACTIVE BUILD

**slug:** `2026-07-29-settings-admin-scope` (STARTING — THINK phase)
**started:** 2026-07-29T05:40:00Z
**instruction (verbatim intent):** "make Settings substantial" — Timezone, Individual user/agent access +
Access Assistance (admin resets password for users/agents), System default Theme (light/dark), users'/
agents' default Learning Mode. Decisions locked: temp-password (user changes next login); theme/learning/
timezone = admin default + user override (resolve user→company→system); all admin actions company-scoped;
"keep adding to the current page"; each column migration-coupled with a guarded fallback (A34).
**source:** founder chat (2026-07-28), decisions locked.

### Requested items → disposition (to fill during BUILD)

| id | item | disposition | evidence / risk if left |
|----|------|-------------|--------------------------|
| S0 | THINK — read current Settings surface + profiles/company schema; find the admin-company-scoped precedent | **DONE** | Explore map: theme=localStorage-only, learning_mode_enabled/experience_mode precedent, /api/me/learning-mode route shape, requireCompanyAdmin + createAdminClient pattern, no admin-password-reset exists yet |
| S1 | Theme — company default + per-user override + DB persist (resolve user→company→system) | **DONE (code)** | migration 0201 + /api/me/theme + ThemeProvider reconcile/persist + ThemePanel; reconcileTheme test 6/6; check exit 0. ⚠ migration 0201 NOT yet applied (guarded → localStorage-only until applied) |
| S2 | Learning Mode — company default | **OFF by default = already satisfied; admin-flip HELD** | founder 2026-07-29: "have this off by default" — already the live behavior (learning_mode_enabled default false; A3). The admin "flip new members to ON" needs a profile-CREATION migration (upsert: handle_new_user + accept_invitation) that I CANNOT test live here — high blast radius, so HELD as a reviewed migration the founder applies+tests, not built blind. Not required for "off by default". |
| S3 | Timezone — per-user override | **FOUNDATION DONE; adoption + override next** | shipped: shared `formatInTimeZone`/`resolveTimeZone` (src/lib/datetime/format.ts, tested 8/8) + first consumer (Settings "Last saved" now renders company.timezone). NEXT: broad adoption across ~12 displays (TZ-01) + `profiles.timezone` override (TZ-02). |
| S4 | Access Assistance | **DECIDED: build it FULLY** | founder chose: admin sets temp password (Supabase admin API, company-scoped) + `profiles.must_change_password` + login-flow redirect forcing the change. Own carefully-tested slice; SECURITY-SENSITIVE. |

### Unfinished at this moment
- **S1 (Theme) DONE + hardened + pushed** (`03bc57d4` + test `ef64f350`). Migration `0201` written, NOT
  applied (needs founder `npm run db:apply`); A34-guarded → localStorage-only until applied.
- **S2/S3/S4 DECIDED (founder 2026-07-29) — building in sequence.** Recommended order by risk:
  S2 (Learning default, low-risk) → S3 (Timezone consumption + override, medium) → S4 (Access Assistance,
  security-sensitive, most careful). Each its own slice + build dir + tests + commit.

---

## ▶ CARRY-OVER QUEUE — real open work across the project (not this build)

> These are the genuinely-not-built items so a resume never treats them as done. Ordered by the
> founder's stated priority. Each names its risk.

| item | state | risk if left / note |
|------|-------|---------------------|
| **AMD-009 ratification** — makes `tbc:revision` mandatory (adds to `tbc` chain) + inserts BUILD-PROTOCOL.md 7.1 + 8.3 + bumps constitution.ts | PROPOSED, awaits founder | say "ratify AMD-009". Until then the revision gate is runnable but not auto-enforced (bounded risk). |
| **Settings admin scope** — Theme, Learning Mode, Timezone (company default + user override + DB persist); Access Assistance (admin temp-password, force-change-next-login, company-scoped) | IN PROGRESS (now the ACTIVE build) | founder approved the design 2026-07-28; each column migration-coupled with a guarded fallback (A34). |
| **DEFINER-revoke `0200`** — ~50 finance SECURITY DEFINER fns anon-callable (cross-tenant config read) | FOUNDER-GATED | MEDIUM security. Fix written + de-risked. Live finance change → needs founder "fix the definer revoke". |
| **Per-tenant AI-cost cap** | SPEC READY, awaits founder NUMBERS | distributed abuse unbounded below tenant until set. 5-surface spec written. |
| **`ANTHROPIC_API_KEY`** (Vercel) | FOUNDER CONFIG | prod is DeepSeek-only → no AI failover (single point of failure). Failover code built + test-locked; activates on key set. |
| **`NEXT_PUBLIC_BOOKING_URL`** (Vercel) | FOUNDER CONFIG | /care/demo "Book a demo" dead-ends at /login → demo not prospect-ready. |
| **`NEXT_PUBLIC_SITE_URL`** (Vercel) | FOUNDER CONFIG | sitemap/canonical say localhost (SEO only; NOT pilot-blocking). |
| **VAPID×3 + `CRON_SECRET`** (Vercel) | FOUNDER CONFIG | VAPID → push delivery; CRON_SECRET → PII-purge crons. |
| **Self-hosted Voice system** | STAGED (0%) by founder choice | not started by design; repo location decided later. |
| **Post-deploy click-throughs** | AWAITS DEPLOY | founder-manual-download + auth-landing verify in prod after next deploy. |

---

## ▶ RECENTLY CLOSED (rolling, newest first)

- `2026-07-29-x3-settings-timezone-foundation` — CLOSED 2026-07-29 — shared timezone formatter
  (formatInTimeZone/resolveTimeZone, 8/8) + first consumer (Settings last-saved). check exit 0.
- `2026-07-29-x2-settings-theme` — CLOSED 2026-07-29 (`03bc57d4` + test `ef64f350`) — theme company
  default + per-user override + DB persist.
- `2026-07-29-x-revision-completeness-mechanism` — CLOSED 2026-07-29 (`b76bdc84`) — durable ledger
  (this file) + revision-completeness gate (`tbc:revision`) + AMD-009 proposal. check exits 0. M6/M7
  (ratification) → carry-over queue.
- `2026-07-29-sales-coach-revision-completion` — CLOSED 2026-07-29 (`86c987fa`) — declutter (4 strings) +
  Standard post-session → after-pitch routing. 2/2 items done.
- `7-day build audit PDF` — DELIVERED 2026-07-29 — `BUILD-AUDIT-7DAY-2026-07-29.pdf` (repo root, untracked
  founder deliverable). 12 initiatives, % completion.
- `2026-07-28-x2-settings-profile-name` — CLOSED (`e8cf99d4`) — edit-your-own-name.
- `2026-07-28-x-founder-manual-download` — CLOSED (`096638ab`) — founder-only build-manual download.
- `auth-entry` — CLOSED (`cdc41701`) — show-password toggle (6 fields) + module-aware landing.
- `TBC install (AMD-008)` — CLOSED (`c53c87b9` + F1–F5 fixes) — THINK·BUILD·CHECK mandatory.

---

*Discipline: update the ACTIVE BUILD table the moment an item's disposition changes; move a build to
RECENTLY CLOSED only when its closure.md exists and `npm run check` is green. An empty ACTIVE BUILD
section means no build is in flight — safe to stop.*
