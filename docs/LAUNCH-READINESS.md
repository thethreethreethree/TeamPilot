# Launch-readiness verdict — 2026-07-24

One-page go/no-go, synthesized from the 2026-07-23→24 verification session. The DECISION list lives in
`FOUNDER-ACTION-QUEUE.md`; this is the readiness lens (what's verified sound vs what blocks launch).

## Verdict: technically launch-ready, gated on ONE decision (`A1 + B1`).

## ✅ Verified sound (launch with confidence)
- **The moat — thesis-core §3.1–§3.6:** verified sound AND built correctly against its own hardest
  temptations — §3.5 measures downstream *consequence* (coached-vs-uncoached durability), NOT agreement
  ("does NOT weight accepted suggestions as proof of value"); §3.3 guides, never overtakes ("you NEVER
  take over"); §3.1 append-only DB-enforced; §3.2 gate fixed (0190). Pure logic is CI-tested; only the
  DB-trigger execution layer has a CI gap (6c).
- **Security — exhaustive, no open hole:** multi-tenant IDOR, extension + in-app auth (fail-closed +
  tested), webhook forgery (constant-time), XSS (escaped both surfaces), SSRF (none), CSRF (header-auth),
  confused-deputy (careFetch host-locked), secret-compare (A34 enforced), widget-embed origin (wired +
  production-no-wildcard tested), notification routing (no misroute), company_brain prompt-injection fix
  (0112 correct — restrict member writes), realtime-token (provider ephemeral, auth-gated).
- **Extension — CWS-submission-ready:** MV3, least-privilege (`activeTab`/`scripting`/`storage`, on-click
  injection only, no auto-inject), complete manifest + icons, all 6 tools verified, follow-up mode shipped.
- **Launch flows:** entitlement plan de-risked to a mis-build-resistant spec; onboarding complete (lands
  in dashboard, no stranding, AMD-006-built); `next build` passes; deploy artifacts carry the fixes.
- **Quality:** widget ADA-accessible, no user tracking, good security headers, zero `@ts-ignore`/`FIXME`,
  rate-limiter logic sound, no N+1, full suite green (1290), all CI gates green.

## 🔴 THE hard blocker (nothing ships without it)
- **`A1 + B1` — entitlement write-path.** Every tenant is `locked`; no flow writes `plan=pro` or starts a
  trial, so no customer can use the verified-working extension. Say the combo → built + tested in one pass.
  (Sub-decisions surfaced: Spawn-during-trial, CRM-tier→plan pricing map, existing-customer backfill.)

## 🟡 With/near launch (not hard blockers)
- Land the **parked build-reliability fix** (5a2 — Node pin for the recurring Vercel-build failures) ·
  `npm audit fix` (2b, low-reachability) · confirm `0112` applied · apply 4 migrations (0188/89/90/91) ·
  browser-test the follow-up mode · set `CRON_SECRET`/VAPID/`NEXT_PUBLIC_CARE_EXTENSION_ID`.

## 🌍 Before EU/CA customers (not US-blocking)
- GDPR/CCPA erasure mechanism (2c — anonymize-not-delete per §3.1) · privacy-page LLM sub-processor
  disclosure (item 2, ties to the DeepSeek provider-posture decision).

## Bottom line
The product is well-built and the moat is real. The single thing between "verified working in the founder's
browser" and "customers can use it" is the entitlement write-path (`A1 + B1`). Everything else is either
verified sound, a low-risk with-launch task, or a pre-EU compliance item.
