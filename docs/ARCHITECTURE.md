# Architecture — TeamPilot (`execos`)

A one-page map of how the system is built. Read the layers top-to-bottom as a single request; the
three cross-cutting concerns (AI, migrations, governance) apply at every layer. Pulled from
`package.json` + config; current as of 2026-08-16. A visual companion exists as the "Stack Map" artifact.

## Stack at a glance

| Concern | Choice |
|---|---|
| Framework | **Next.js 16** (App Router) · **React 19** · **TypeScript 5** (strict) |
| Hosting | **Vercel** — two projects: app (`elostate.com`) + marketing (`…-iota.vercel.app`) |
| Data | **Supabase** — Postgres + Auth + Row-Level Security (`@supabase/supabase-js`, `@supabase/ssr`) |
| AI | **DeepSeek** primary → **Anthropic** cascade, via a single `llmCall`/`llmStream` chokepoint |
| Voice | **ElevenLabs** — STT + TTS only |
| UI | Tailwind CSS 3.4 · framer-motion · lucide-react |
| Monitoring | Sentry (`@sentry/nextjs`) |
| Tests | Vitest (~2944 tests) |

## The request path (top → bottom)

1. **Client & UI** — `src/app/**` (pages), `src/components/**`. React 19 + Tailwind. Two browser
   extensions (`extension/` for C.A.R.E, `extension-sales/` for Sales Coach) are built at `prebuild`.
2. **Next.js App Router (edge + server)** — SSR + `middleware.ts` (preserves rotated Supabase auth
   cookies on every redirect; enforces the single-module hard-lock). Runs on Vercel.
3. **API routes & auth gates** — `src/app/api/**`. Every route resolves identity **server-side**, then
   reads through the appropriate client:
   - **RLS user client** (`@/lib/supabase/server`) — the default; tenant/owner scope enforced by Postgres RLS.
   - **service-role client** (`@/lib/supabase/admin`) — bypasses RLS; used only behind an explicit gate.
   Key gates: `requireVendorAdmin()` (vendor back-office), `getSession()` (owner-or-manager on a session),
   plus `zod` validation and `rateLimit` on write/LLM routes.
4. **Supabase · Postgres** — RLS on every table. State is modelled as **append-only events**; entity
   state is derived by replaying them (see Data model). Migrations live in `supabase/migrations/`
   (`0001` → `0214`) and are applied **only** via `npm run db:apply` (ledger-tracked).

## Data model — event sourcing

The core chain is `events → signals → problems → resolutions → (new events)`. Events are immutable and
append-only; you never update or delete, you append. This is enforced at the database (triggers), not by
convention, and verified live by `npm run verify:live`. The "understanding gate" (a problem may not
surface to a user until it links to enough supporting signals) is likewise structural.

## Cross-cutting concerns

- **AI / voice** — all model calls funnel through the `llmCall` / `llmStream` chokepoint (`src/lib/`),
  which handles the DeepSeek→Anthropic cascade and the JSON/output contract. Transcript-bearing prompts
  are fenced with `CONVERSATION_IS_DATA` against prompt injection (guarded by invariants 23–25).
- **Migrations** — `db:check` (validate vs ledger) → `db:dry` (preview, no writes) → `db:apply` (apply +
  auto `verify:live`) → `db:reconcile` (detect off-ledger drift). Ledger table: `public._agent_migrations`.
- **Governance / quality** — see below.

## The quality gate — `npm run check`

Every substantive change clears, in order:

```
typecheck → lint (ESLint 9 flat) → theme:audit → rls:audit → invariant:audit → tbc → test
```

- **`rls:audit`** — every table has RLS; every op is covered; every write pins the tenant.
- **`invariant:audit`** — INV1–25: constitutional invariants the codebase has already paid for
  (cross-person read gating, tenant-scoped writes, prompt-injection fences, error-as-no-data, etc.).
  Each is self-tested and detection-proven.
- **`tbc`** — the "Think-Build-Check" build protocol: substantive changes ship a `docs/tbc/<date>-slug/`
  record (think / build / check / remediate / closure), validated at commit time.
- **Git hooks** — `pre-commit` + `commit-msg` require the `Session-Reads:` citation trailer and TBC freshness.
- **`verify:live`** — runs the invariant set against live production (read-only) to confirm the deployed
  system still holds them.

## Key conventions

- **Never hand-apply a migration** — always `npm run db:apply` (hand edits cause off-ledger drift).
- **Tenant isolation is the top invariant** — service-role reads must prove ownership/tenancy before use.
- **The vendor (founder) tier** is `is_vendor_super_admin()` (DB) / `requireVendorAdmin()` (routes) — an
  admin whose company IS the vendor company. Its one sanctioned cross-tenant capability is founder session
  monitoring (allowlist-scoped to existing companies + audited); that exemption is intentional.
- **Governing docs** — `CLAUDE.md` (operating constitution) and `ThinkerThinker.md` (reasoning method) are
  the source of the invariants and the build protocol.
