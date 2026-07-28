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

**slug:** `2026-07-29-x-revision-completeness-mechanism`
**started:** 2026-07-29T05:10:00Z
**instruction (verbatim intent):** "create a detailed structured solution so when I interrupted you or
we lose internet, you can have specific detailed information of what was left unfinished, and all the
possible risk/complications" + "find a permanent solution so it doesn't occur again" (the recurring
'revision reported done while partial' pattern the founder named critical).
**source:** founder chat (2026-07-29)

### Requested items → disposition

| id | item | disposition | evidence / risk if left |
|----|------|-------------|--------------------------|
| M1 | Durable unfinished-work + risks ledger (`docs/BUILD-STATE.md`), maintained during every build | **DONE** | this file exists + is populated with real state |
| M2 | Revision-completeness gate (`scripts/tbc/verify-revision.mjs`) — every requested change dispositioned before closure | **DONE** | gate file + detection test (fails on un-dispositioned item, green when all done) |
| M3 | `revision.md` manifest for this build (all items dispositioned) | **DONE** | `docs/tbc/2026-07-29-x-revision-completeness-mechanism/revision.md` |
| M4 | Retro-demonstrate on the motivating incident (sales-coach revision) | **DONE** | `docs/tbc/2026-07-29-sales-coach-revision-completion/revision.md` (2 items, both done) |
| M5 | Standing-protocol write-up (exact `BUILD-PROTOCOL.md` §7.1 + §8.3 text) so the discipline runs every build | **DONE** | text authored verbatim in AMD-009; insertion into the §7-governed BUILD-PROTOCOL.md deferred to ratification (part of M7) |
| M6 | On-record amendment proposing the gate become MANDATORY (`AMD-009`) — founder ratifies | **DEFERRED** | defer_reason: making a gate mandatory is a governance act (AMD-008 precedent, A28) — proposed, not self-ratified while founder offline. Risk if left: gate is runnable but not auto-enforced until "ratify AMD-009". |
| M7 | Wire `tbc:revision` into the mandatory `npm run check` chain | **DEFERRED** | defer_reason: mandatory-chain wiring is the ratification act (M6). Exact one-line diff pre-written in AMD-009. Risk if left: a future revision build could skip the manifest until ratified. Mitigation: the runnable gate + this ledger + the protocol doc. |

### Unfinished at this moment
- **Verification DONE** — `npm run check` exits 0 (1602 tests, all gates), pasted in this build's
  closure.md §3. `npm run tbc:revision` green standalone.
- **M6 + M7 only** remain — both awaiting the founder's one-word ratification ("ratify AMD-009"):
  M6 = flip AMD-009 to ratified + bump `src/lib/constitution.ts` (INV12); M7 = apply AMD-009 §4 (add
  `tbc:revision` to the `tbc` chain) + §5 (insert BUILD-PROTOCOL.md 7.1 + 8.3). Exact diffs pre-written in
  AMD-009. Until then the gate is runnable but not auto-enforced (bounded risk, tracked here).
- No mid-edit files; the mechanism is complete, tested, and committed.

---

## ▶ CARRY-OVER QUEUE — real open work across the project (not this build)

> These are the genuinely-not-built items so a resume never treats them as done. Ordered by the
> founder's stated priority. Each names its risk.

| item | state | risk if left / note |
|------|-------|---------------------|
| **Settings admin scope** — Theme, Learning Mode, Timezone (company default + user override + DB persist); Access Assistance (admin temp-password, force-change-next-login, company-scoped) | DECIDED, NOT BUILT (~15%: only name-edit shipped) | founder approved the design 2026-07-28; each column migration-coupled with a guarded fallback (A34). No risk of breakage — simply unbuilt. Next build. |
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
