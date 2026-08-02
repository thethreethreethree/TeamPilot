# Proposal — Billable realtime-STT usage metering for coaching

**Status:** design-ready, awaiting founder go (billing-substrate schema → §3.3, founder-gated).
**Date:** 2026-08-02
**Trigger:** Pricing Phase 3 meters realtime coaching per-minute, but the system tracks only
session **wall-clock** (`coaching_sessions.started_at` / `ended_at`, [0070]) — never the
**billable STT-minutes** actually streamed to ElevenLabs. Without this, usage-based billing
has no accurate substrate; wall-clock over-bills (a session left open reads as streamed time)
and can't isolate realtime STT from batch/saved-recording transcription (a different cost line).

---

## What's missing

The one unit the meter prices — *seconds of audio actually sent to the realtime STT provider* —
is not recorded anywhere. A grep for any `stt_min` / `audio_min` / `usage.*minute` / `meter`
substrate returns nothing. The realtime coaching client is the **only** place that knows this
number (it counts the bytes/frames it streams); it must persist it.

## Design — append-only usage events (NOT a mutable counter)

A `billable_seconds` counter column on `coaching_sessions` is **wrong** here for two reasons:
it would be an UPDATE-in-place (violates §3.1 events-are-immutable), and concurrent window
flushes would race on the increment. The correct shape is an append-only event table — which
also makes the immutable log itself the billing evidence (auditable, replay-derivable).

```sql
-- NNNN_coaching_stt_usage_events.sql  (append-only; the billable-minutes source of truth)
create table if not exists coaching_stt_usage_events (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references coaching_sessions(id) on delete cascade,
  company_id        uuid not null references companies(id),   -- tenant scope + billing rollup
  agent_id          uuid not null references profiles(id),    -- per-rep attribution; MUST match
                                                              -- coaching_sessions.agent_id (0070 → profiles),
                                                              -- NOT auth.users, so joins/RLS stay consistent
  window_seq        int  not null,                            -- client-monotonic per session
  billable_seconds  int  not null check (billable_seconds > 0),
  stream_started_at timestamptz not null,
  stream_ended_at   timestamptz not null,
  created_at        timestamptz not null default now(),
  -- IDEMPOTENCY: a network retry re-POSTing a window must NOT append a duplicate row
  -- (duplicate row = customer over-billed — the append-only double-write class).
  unique (session_id, window_seq)
);

create index if not exists coaching_stt_usage_company_period_idx
  on coaching_stt_usage_events (company_id, stream_started_at);
```

### Billable minutes (derivation, never stored mutable)
```sql
-- minutes per company per period = replay/sum of the immutable events (§3.1 derive-don't-store)
select company_id, date_trunc('month', stream_started_at) as period,
       ceil(sum(billable_seconds)::numeric / 60) as billable_minutes
from   coaching_stt_usage_events
group  by company_id, period;
```
Round-up per billing period (not per window) so a customer isn't nickel-rounded on every flush.

## Guards this must carry (learned from prior incidents)

- **Idempotent append.** `unique (session_id, window_seq)` + `on conflict do nothing` at the
  write. Prevents retry-double-bill (the append-only double-write class, hit 12× before).
- **Owner check on write (INV19).** The append route must assert the caller **owns** the
  session (`session.agent_id === user.id`), not merely that it's same-company — a company
  getSession is company-scoped, so a colleague could otherwise inject usage into another rep's
  session. Cross-*user* axis, not just cross-tenant.
- **Tenant-pinned insert (INV15).** Any service-role write pins `company_id` from the session,
  never from client input.
- **RLS.** Company admins (CEO/COO/admin) read their company's usage (mirror 0083's coaching
  read policy); reps read their own. No cross-company read.

## Where it wires in

The realtime coaching stream handler (the code path that opens the ElevenLabs realtime socket)
already frames audio into windows. At each window flush — or on a periodic tick — it appends one
usage event with the exact seconds it streamed. `window_seq` is a per-session counter the client
already can maintain. This measures **streamed audio**, not wall-clock: pauses, mic-off, and
open-but-idle sessions correctly cost nothing.

## What this unlocks

- Accurate per-minute billing (the Phase 3 meter gets its real substrate).
- Converts the "15 hrs/rep/mo" pricing assumption into a **measured** figure from live data.
- A per-rep / per-company coaching-intensity signal that feeds the KPI system.

## Not doing (scope guard)

- No live migration applied here — this is the design; the migration + client wiring is the
  founder-gated build.
- No pricing rates embedded (kept out of the repo per IP discipline). This doc is pure
  technical instrumentation; the meter rate lives only in the founder-held pricing deliverable.

**Green-light phrase:** `"build the STT metering"`.

---

## ADDENDUM (2026-08-02) — under the simplified flat pricing, the PURPOSE shifts (design unchanged)

The pricing pivoted to simple flat tiers (coaching is flat / fair-use, no customer-facing meter). This does
NOT change the design in this doc — the `coaching_stt_usage_events` table is still exactly what's needed — but
it changes WHY it exists, and if anything makes it MORE important:

- **Was:** the substrate for *customer billing* (per-minute overage on the metered model).
- **Now:** the substrate for **internal cost-tracking + fair-use enforcement**. Under flat pricing there is no
  per-minute revenue recovery, so this is how you (a) spot a runaway-cost customer, (b) enforce the fair-use
  ceiling the flat margins assume, and (c) measure real coached-minutes to price the coaching seat correctly.
- **Pairs with `"cap live-coaching sessions"`:** flat pricing shifts cost-protection from the meter to the
  product. Usage tracking (this doc) + the session cap together ARE the margin protection the flat model needs.

The table, guards (append-only, idempotency, owner-check, tenant-pin) are all unchanged — only the consumer of
the data changes (internal cost dashboards / fair-use checks, not a customer invoice line). Green-light phrase
and gating unchanged.

---

## Substrate verified against the tree (2026-08-02)

Premises re-checked against the live migrations before the founder-gated build:

- **No existing STT/billable-minutes substrate** — a grep across `supabase/migrations/` and `src/lib/coach/` for
  `stt_min` / `audio_min` / `billable_second` / `usage.*minute` / `meter*` returns **nothing**. The proposal's
  core premise (the priced unit is recorded nowhere) is confirmed; `coaching_stt_usage_events` is a genuine new
  substrate, not a reinvention.
- **`coaching_sessions` (0070)** confirmed present with exactly the columns this design references:
  `agent_id uuid not null references profiles(id)` (so the new table's `agent_id → profiles` FK stays consistent —
  not `auth.users`), `started_at`, `ended_at`.
- **The "0070 already stamps `ended_at`" claim** (shared with the auto-close proposal) is real: trigger
  `stamp_coaching_session_ended_at` at `0070_live_sales_coach_foundation.sql:104-121` stamps `ended_at` on the
  transition. The INV19 owner-check + RLS-mirror guards are grounded in the actual 0070 policy shape
  (`agent_id = p.id or role in ('CEO','COO','admin')`, 0070:159).

No code written — verification only, so "build the STT metering" starts on confirmed ground.
