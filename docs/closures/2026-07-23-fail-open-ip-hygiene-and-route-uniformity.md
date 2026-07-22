# Session closure — 2026-07-23

Fail-open hardening · sensitive-IP hygiene · extension-route error-handling uniformity.

Three complete, durable threads. Every finding was reached by auditing (outside-view read of
the actual code), fixed to the class boundary (§A26), and locked with a test or a founder-runnable
verifier. Full suite green throughout (ended at 1225+ passing). All commits pushed to `main`.

---

## Thread 1 — Fail-open in the structural invariants

Applied one lens to every core guarantee: *what happens when the guard's config is missing or bypassed?*

| Invariant | Result | Commit |
|---|---|---|
| §3.2 Understanding Gate (DB, 0002) | **FAIL-OPEN** — missing threshold row → NULL compare → problems surface ungated. Fixed to fail-**closed** (`0190`). | `89a79170` |
| §3.2 gate — founder-runnable verifier (safe self-rollback SQL) | added | `eeaad478` |
| §3.2 gate — JS mirror (`understandingGate.ts`) | same class via spread-with-`undefined`; hardened per-field `??` + test | `64c0d3eb` |
| §3.1 event immutability (0004) | sound — unconditional rules, no app mutation path | — |
| Finance depreciation (0166) / recurrence (0186) / ledger balance (0118) | sound — SQL matches test mirrors; RLS `with check` blocks direct status→posted | — |
| Finance authz predicates (0116) | fail-closed (positive allowlists) | — |

**Needs you:** apply `0190` and run `supabase/tests/verify_0190_understanding_gate_fail_closed.sql`
(the sandbox can't reach the DB, so this is verified statically only).

**Policy question surfaced (not a bug):** `fin_effective_role` (0116) auto-grants CEO/COO/admin
profiles `cfo`-level finance authority (→ unlimited approver) with no explicit `fin_roles` row.
Intended, or should finance authority require an explicit grant? One fix cascades to every
`fin_can_*` check and the approval-limit trigger.

---

## Thread 2 — Sensitive-IP (§ methodology) leaks in customer-facing UI

The methodology docs are the product's IP moat; their section labels belong in developer comments,
never in product surfaces. A sweep found **26 leaks** — the customer-facing sales demo, dashboard
subtitles/headers/tooltips/placeholders, a literal `§4 readouts` heading, an admin API note, coach
error messages, and the extension panel's suppressed-Spawn message. All rewritten to plain
meaning-preserving language.

| Work | Commit |
|---|---|
| Strip § citations from 24 UI sites | `4ddb5d95` |
| Regression guard (`src/__tests__/no-methodology-citations-in-ui.test.ts`) + 2 more leaks it caught | `0e9ed89f` |
| Document guard scope (why src/lib is excluded — arrow-fn false positive) | `645ca3db` |
| Extend guard to Layer 1 (methodology-doc **filenames**) too | `f64d8725` |

Both halves of the IP rule are now test-enforced; CI fails if a § citation or a doc filename
re-enters any user-facing string.

---

## Thread 3 — Extension tool-route error handling (uniformity)

All six C.A.R.E extension tool routes now handle a model **rate-limit** error identically:
`LlmError kind=rate_limit → 429` (client backs off), any other kind → `502`.

| Route | Before | Commit |
|---|---|---|
| spawn | already 429/502 — added the two-distinct-502-codes + 429 branch tests | `33232afd` |
| coach | already 429/502 — same branch tests added | `3de6a6e0` |
| copilot, formulate | blanket `catch → 502` (rate limits mis-signalled) → harmonized to 429/502 + tests | `6cc26d84` |
| summarize | same blanket 502 → harmonized + test | `c475bf02` |
| dissect | **verified safe**: its engine wraps the LLM call in try/catch → returns EMPTY (200) and never throws, so no unhandled-500 path | — |

Minor design note (left as-is, deliberate + uniform): on a rate limit `dissect` shows
"no signal" rather than signalling the throttle — the engine's graceful-empty contract, consistent
with its in-app use.

---

## Thread 4 — Extension privacy + client-security audit (verified clean)

Traced the extension's data-flow and client security end-to-end. All sound; one founder decision surfaced.

- **Storage / D1 privacy claim — HONEST.** No extension route, engine (`claude.ts`, `dissect/engine.ts`),
  or LLM client writes the scanned conversation to our DB or logs. The LLM client's two `console.warn`s log
  only provider name + error kind, never message content.
- **Client security — sound.** `background.js` validates the tool endpoint against an anchored allowlist
  (`/^\/api\/care\/extension\/[a-z]+$/`) so the token-bearing fetch can't be pointed at an arbitrary URL;
  `externally_connectable` is origin-locked to localhost + elostate.com (no token injection from other sites);
  `activeTab` (not broad host permissions) means adapters read a page only on explicit user click.
- **LLM layer — well-engineered.** Provider cascade (`shouldCascade`) fails over only on operator-fixable
  `auth`/`quota` errors, never on request-level ones; fully tested.
- **FOUNDER DECISION surfaced (data-governance):** the LLM layer prefers **DeepSeek (China-based) as the
  PRIMARY provider whenever `DEEPSEEK_API_KEY` is set** (not just a fallback), and no route pins Anthropic — so
  customer conversations the extension pulls from external inboxes route there, and on auth/quota failover reach
  the other provider too. Storage is honest (nothing persisted); *where processing happens* is the open call.
  Flagged at the top of `docs/FOUNDER-ACTION-QUEUE.md`. Offered build: pin the extension routes to Anthropic.

## Your queue (all founder-gated)

1. **Apply `0190`** + run its verifier.
2. **Entitlement write-path** — trial mechanism (1 auto / 2 button / 3 signup) + paid-unlock
   (CRM-tier→plan sync, or admin toggle). *The launch blocker* — the extension is `locked` for every
   tenant until this ships.
3. **Merge the 4 ready branches** (sharp-CVE first) + the per-seat pricing model.
4. **Leadership→CFO policy question** (Thread 1).
