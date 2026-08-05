# Autonomous session audit — 2026-08-05

On-record audit trail (§1.7.4) for the 2026-08-05 session so a later audit can compare against this
baseline instead of re-checking the classes verified clean here. All work is committed to `main` and gated
on `npm run check` (CI confirmed green via the check-runs API across the session).

## Headline
Founder request delivered (Sales Coach: no minimum length — every session generates all content, honesty
preserved, verified engine→pixels, guarded, all ripples traced). Then a sustained ground-up audit: one
systemic authz-vocabulary gap fixed + gated, several coverage gaps on sensitive routes closed, a drift-guard
class extended, and ~8 high-consequence classes verified clean.

## Founder request — delivered + verified
- **Sales Coach no-minimum-length.** Removed BOTH "too thin" layers (LLM prompt refusals + engine
  3-4-segment floors) across every v5 engine; `§3.4` honesty preserved (short call → short REAL read). Verified
  the four named surfaces render engine→pixels; cost ripple bounded (rate-limited + cached); Sales-ELO ripple
  traced BENIGN (quality is a ratio, not a count — quick wins score well). Locked by 4 detection tests
  (unit + integration) + an ELO short-win guard. TBC: `docs/tbc/2026-08-05-salescoach-no-minimum-length/`.
  **Founder action: confirm on one real short pitch (RES-01).**

## Gaps FOUND + FIXED (committed)
- **Systemic §A13 authz-vocabulary gap.** `roles.ts` is the single source for the admin set, but ~12 gates
  (RoleSchema + after-pitch + careAgentAuth + Sidebar + 5 server routes + 3 client sites) hardcoded
  `CEO||COO||admin` inline — a real drift risk. Migrated ALL to `isAdminRole`/`INVITABLE_ROLES` (each verified
  behavior-preserving, full suite green), boundary confirmed clean, **locked with an A30 guard**.
- **6 CRM enum drift contracts** (TS unions ↔ Postgres `create type … as enum`, migration 0049) were
  unguarded — the existing enum guard only covered `col in (…)` CHECKs. Now guarded (12 assertions).
- **Authz deny-path coverage** on 4 sensitive routes that had ZERO tests: `leadership/readouts`,
  `leadership/team`, `care/coach-assessment`, `feedback/[id]`. Deny paths pinned.
- **Vendor-CRM (past-CRITICAL 0089):** verified all 6 `admin/crm` routes consume `requireVendorAdmin`
  correctly across every method (incl. the 2 non-standard consumers), + a **structural guard** so a future
  ungated CRM route fails CI.
- Smaller: a comment misrepresenting an enforced sync as "by convention" + a mis-cited axiom (§A4→§A13); a
  low-severity UTC-vs-local "last edited" stamp.

## Verified SOUND (no fix needed — the baseline for future audits)
- **CSV formula-injection (CWE-1236):** every export routes through `neutralizeCsvFormula` (`toCsv` /
  `statementsToCsv`); imports are not the vector; the `.join(",")` hits are PostgREST filters.
- **LLM prompt-injection fence:** all 14 customer-reply routes go through `generateCareReply` → the
  `prompt.ts` fence (defangs forged delimiters, hardened vs a past forged-fence refund attack). Coach
  transcript engines use `CONVERSATION_IS_DATA`, guarded by INVARIANT 23. Defang primitive comprehensively
  tested (`knowledgeFence.test.ts`).
- **Fire-and-forget serverless writes:** `after()` adopted where needed; no unprotected `void asyncWrite()`.
- **localStorage/sessionStorage throws:** every access guarded (try/catch) — team is uniformly disciplined.
- **Append-only double-write:** `useRef` latch pattern widely adopted (~10 components).
- **KPI compute coverage:** every exported metric in `compute.ts` is tested (a survey false-positive on
  `winLossRatio` was caught by direct verification — it IS tested 5×).

## Data-integrity findings (LATENT, founder-gated fix — NOT customer-facing fires)
- **coach-assessment windowed aggregate** (`.limit(300)` team-wide → per-rep count/content wrong for reps
  outside the window; worsened by the no-minimum build). MEDIUM, manager roll-up only. **One-word triggers in
  the queue.**
- **assetReadout unbounded select** (file view/download/citation counts truncate past 1000). LOW — internal
  founder-files feature, latent. Same-class fix (server-side count/RPC).
- Confirmed CLEAN where it matters: no customer-facing unbounded aggregate (`support_messages` reads are
  conversation-scoped, ≤38 rows).

## Flagged, not done (honest — a safe fix wasn't available under autonomous conditions)
- `chat/topic-decisions` authz test — compound gate (participant AND (topic-admin OR company-admin)) + full
  POST flow; deliberately NOT mocked under pressure to avoid a false-confidence test (§5).

## Needs YOU (founder-gated — one-word triggers in the queue)
- `RES-01` — confirm Sales Coach on one real short pitch.
- `"fix the coach-assessment count"` / `"redo the coach-assessment window, N=<n>"`.
- Standing items: IP copy rewrite, VAPID vars, pricing numbers (in the queue).
