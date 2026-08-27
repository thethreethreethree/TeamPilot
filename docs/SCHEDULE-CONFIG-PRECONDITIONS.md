# Schedule Management System — External-Config Preconditions

> Mandated by `ScheduleManagementSystem.md` sections 6 + 8 and CLAUDE.md external-config-completeness (AMD-011 / A41): any correctness that depends on
> config **outside the repo** must be *verified end-to-end* or *documented as a blocking setup step and surfaced to
> the founder* — never assumed silently. This is that record. Written 2026-08-27 during the schedule audit (the design
> mandated this file; it was missing). The general cross-cutting sweep lives in `docs/CONFIG-PRECONDITIONS-AUDIT.md`
> (AMD-011); this file adds the schedule-specific items and the verification procedure.

Status legend: ✅ verified/fail-loud in place · ⚙️ a founder setup step (documented, not an env var) · N/A not used here.

---

## 1. ✅ DeepSeek API key — fail-loud via the health endpoint
The schedule **AI assistant** + reasoning layer (`src/lib/schedule/ai.ts`, `assistant.ts`, `assign/suggest`,
`timeoff/evaluate`) call the shared LLM path (DeepSeek primary). The key lives in Vercel project env, outside the repo.

- **Fail-loud:** `GET /api/health` reports `capabilities.llmReady` + `providers.deepseek`. A missing/invalid key →
  `llmReady:false`, visibly. The assistant route also fails loud on an LLM error (502) and — post-audit — reports an
  empty/starved reply as an honest system message, never a silent empty proposal.
- **Verify:** `curl -s https://elostate.com/api/health | grep -o '"llmReady":[a-z]*'` → expect `"llmReady":true`
  (confirmed true 2026-08-27). The deterministic authority (coverage/eligibility math) does NOT depend on the LLM, so
  even with the key down the gate + verdict still work; only the natural-language proposals degrade.

## 2. ✅ Supabase env (URL, anon key, service-role key) — per Vercel environment
Every schedule route derives `company_id` from the session (`getCurrentAuthContext`) and reads/writes under RLS; the
service-role key backs the append RPC + admin reads. These are external env, required in **both** preview and prod.

- **Covered by** `docs/CONFIG-PRECONDITIONS-AUDIT.md` (AMD-011) — the two-project / preview-domain drift is the A41
  cautionary case. No schedule-specific addition beyond "present in each environment."
- **Verify:** `/api/health` `capabilities.{auth,persistence}` true; a schedule read returns data (not a 500).

## 3. ✅ Supabase RLS + append-only on `schedule_event` — live-verified, not just migration intent
Append-only is external-ish config (it lives in the live project's policies/triggers, not only in migration text).

- **Enforced:** migration `0220` installs a `before update or delete` trigger that raises
  `schedule_event is append-only` AND `revoke update, delete`; the appender requires an authenticated company context
  (`0227` manager-gating, `0230` RLS INSERT check). Manager-only is a three-layer defense (route + RPC + RLS).
- **Verify (behavioral, not structural):** `node scripts/diag-schedule-security.mjs` — simulates member / support-agent
  / company-admin JWTs under RLS inside a rolled-back transaction, proving the trigger fires even for a privileged
  writer and cross-tenant reads return 0. Run against the live project after any schedule RLS/trigger migration.

## 4. ⚙️ Org timezone — a per-company SETUP STEP (default UTC), not an env var
Schedule correctness depends on the org's timezone ("today", day boundaries, overnight shifts). Per the design doc's section 6
this is the one schedule-specific config item — but it is handled as a **stored, validated company setting**, not an
external env dependency:

- **Where:** `schedule_settings.timezone` (IANA name), read by `getScheduleSettings` (`src/lib/schedule/settings.ts`).
  Default `UTC`; an invalid/unknown tz is coerced to UTC via `isValidTz` (`Intl.DateTimeFormat`); a missing 0224 column
  falls back to defaults without asserting the migration (A34).
- **The setup step (surface to the founder):** a company whose real timezone is **not UTC** should set it in Schedule →
  Settings. Until they do, "today" and day boundaries compute in **UTC**, which can misalign a shift that crosses local
  midnight for a non-UTC company. This is a bounded default (safe, visible in Settings), not a silent hard dependency —
  but it IS a real setup step for correctness in the operating timezone.
- **Verify:** open Schedule → Settings and confirm the timezone matches the company's operating region.

## 5. N/A — Vercel cron
The schedule system has **no background cron**: state is derived on read (replay the event log), and there is no
projection/notification cron. So the design's "guard the cron with `CRON_SECRET`" precondition does not apply here.
(If a schedule projection/notification cron is ever added, it MUST be `CRON_SECRET`-gated and registered in
`vercel.json` — the pattern the other crons already follow.)

---

## Quick verification checklist (run before relying on a new environment)
```
curl -s https://<host>/api/health | grep -oE '"(llmReady|auth|persistence)":[a-z]+'   # 1, 2 — expect all true
node scripts/diag-schedule-security.mjs                                                # 3 — expect exit 0
# 4 — open Schedule → Settings, confirm the org timezone (default UTC if unset)
```

Per the external-config-completeness rule: "the code builds and the green check passed" ≠ "it works" when an env var, an RLS policy, or the org
timezone is unset. Items 1–3 fail loud / are behaviorally verifiable; item 4 defaults safely but is a real setup step.
