# Post-TBC verification sweep — 2026-07-28

Run after the THINK·BUILD·CHECK integration + the five gate-audit findings (F1–F5) were
shipped, to confirm the system is healthy at every reachable layer. Read-only except where
noted. Recorded per the data-as-asset principle (a clean audit is an asset, not a non-event).

## Layers verified

| Layer | Check | Result |
|---|---|---|
| Code | `npm run check` — typecheck · lint · theme · rls · invariant · **tbc** · test (7 gates, 1602 tests) | ✅ exit 0 |
| **Live production data** | `npm run verify:live` — 14 invariants (append-only events, finance immutability + balance, tenant RLS on every company_id table, pilot-code sealing, storage-bucket privacy) | ✅ all 14 hold |
| Security | Browser-API-throw lens — 46 call sites (localStorage / clipboard / AudioContext / Notification) | ✅ all guarded (try/catch, `typeof window`, or feature-gated render) |
| Security | Signed-URL bearer capability (A27) — 3 issuance sites | ✅ all prove access before signing (RLS-bound client / two sanctioned `signAssetUrl` callers, both gated) |
| Security | CWE-209 raw-exception leak — public API error responses | ✅ no high-severity public leak (see finding below) |

## Finding (LOW — hardening, not a vulnerability)

**Authed routes return the raw Supabase `error.message` in their JSON error body.** ~20 sites
(finance, tasks, team, notifications, resolutions, …) do `NextResponse.json({ error: error.message })`
on a Supabase error. The caller is always authenticated and tenant-scoped, so this is not a
cross-tenant or anonymous leak — but a Supabase error message can name a constraint or column,
which is mild internal disclosure.

- **Not to be confused with** the intentional `LlmError` shape on the AI/LLM routes
  (`{ error: err.message, kind, provider }`) — that taxonomy is deliberately surfaced to the UI.
- `/api/llm/ping` returns `err.message` on a **public, rate-limited (6/min)** endpoint, but it is
  a diagnostic whose purpose is to report LLM connectivity; it leaks only LLM-provider-domain
  info, never DB internals / PII / tenant data. By design.
- **Recommended (deferred):** a small `jsonError(err, fallback)` helper that logs the detail
  server-side and returns a generic client message, adopted at the ~20 authed Supabase-error
  sites. This is a defensive-hardening refactor across many files — a TBC-governed build — and
  is **not** urgent; recorded here so it is actionable when prioritised, not lost.

## Disposition

System verified healthy at code, gate, and live-production-data layers. No action required;
one LOW hardening item deferred above.
