# Security audit — 2026-07-26 (RCD build + adjacent gates)

Proactive audit (§1.5.2 / §1.7) run while building RCD, recorded on the immutable record (§1.7.4) so a
future session can compare. Stance: outside-view (§1.3). Result: **all surfaces sound**; one latent risk
found and hardened (source_url). No cross-tenant leak, no fail-open, no injection vector found.

## 1. Storage buckets (`storage.objects` RLS) — the gate doesn't cover this; audited by hand

| Bucket | public | Read | Write | Verdict |
|---|---|---|---|---|
| `assets-v1` (0062) | false | tenant-scoped `foldername[1]=auth_company_id` | tenant-scoped | SOUND |
| `widget-logos` (0064) | **true** (by design — shown on public customer widgets) | public | tenant-scoped writes only | SOUND |
| `care-rcd-media` (0194) | false (PII) | tenant-scoped SELECT | service-role / one-time signed upload URL, path fixed server-side from auth | SOUND |

No private bucket is world-readable; no bucket allows cross-tenant writes. The new PII bucket cannot leak
(read scoped to the caller's company path; the extension can only upload to the exact path the server
issues from its auth). **Recommendation on record (A33-declined as a gate):** `rls:audit` checks `public`
table policies but NOT `storage.objects` — a future public-by-mistake bucket wouldn't be caught by CI. A
precise gate isn't feasible (imprecise SQL-policy parsing), so kept as prose.

## 2. Cron auth — all 6 routes

`durability-sweep`, `rcd/retention`, `backfill-dissects`, `recording-purge`, `task-overrun-sweep`,
`finance/reports/deliver`: every one imports + **calls** `constantTimeEqual` exactly once for the Bearer
check (no timing attack), uses no raw `===` on the secret, and fails closed (503) when `CRON_SECRET` is
unset. No unauthenticated or timing-attackable cron endpoint. **SOUND.**

## 3. Extension entitlement gate — protects ALL paid access (RCD + tools)

The gate is a denylist (`if status === "locked" → 402; else ok`), safe only if the entitlement decision
returns `locked` for everything non-entitled. Verified fail-closed by construction:
- `computeExtensionEntitlement`: `active` only for `pro`/`enterprise`; `trial` only for a valid unexpired
  window; **`locked` otherwise** — null plan (→ `pilot`), unknown plan, invalid/expired trial.
- `getExtensionEntitlement`: `locked` on any non-degradable DB error (explicit "fail closed for a paid
  feature"); missing trial column degrades to a plan-only read (A34), not a crash.
- Denylist is therefore effectively an allowlist — `active`/`trial` are only returned when genuinely
  entitled. **No fail-open vector. SOUND.**
- Confirms the launch-blocker analysis: every tenant is `locked` by default (correct); only the *write*
  half (founder's `A1+B1`) is missing.

## 4. RCD adversary + CFO lens

- **Cross-tenant:** ingest (company from auth, never client), read routes (RLS + explicit company match),
  storage (company-path scoped) — no read/write across tenants.
- **Injection/XSS:** uploaded content can't XSS (private bucket, non-HTML MIME allowlist, served via signed
  URL not our origin); `channel`/`sender`/`filename`/`body`/`preview` are all React-escaped on render.
- **Latent risk FOUND + HARDENED:** `source_url` was stored raw (safe only because nothing renders it). Now
  sanitized to http(s)-only at the ingest chokepoint (`sanitizeSourceUrl`, tested) — safe by construction
  even if a future surface renders it. Commit `d5534af5`.
- **CFO/cost:** RCD storage has no per-tenant cap; retention is dormant until the founder activates it →
  unbounded storage per tenant until then. Bounded near-term by the 30/min rate limit; the control is
  activating the retention cron. A hard cap needs founder numbers (same class as the AI-cost cap).

## Honest scope
Audited the surfaces RCD introduced or touched + the gate protecting them. Did NOT re-audit the full
service-role surface (prior sweeps 0090–0111 + the 2026-07-25 tenant-isolation sweep cover more). Adapter
capture *quality* per channel remains runtime-unverified (founder per-channel testing).
