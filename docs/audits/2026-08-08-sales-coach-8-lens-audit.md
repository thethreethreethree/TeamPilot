# Sales Coach — multi-lens audit (2026-08-08, 14 lenses)

Ground-up, on-the-record audit of the Sales Coach directive surface (the browser extension + the in-app Sales Coach
product), run across every recorded audit lens relevant to this domain. Every lens was checked against the
actual code (not grep verdicts): a suspect is verified before it's fixed, and "clean" means read-confirmed.

## Result at a glance

| Lens | Result | Evidence |
| --- | --- | --- |
| Honest-empty / false-empty (honesty thesis) | **7 gaps FIXED** | recipe-swept + independent-audit-confirmed (see below) |
| C.A.R.E → sales extension port-gaps | **13 gaps FIXED** | UX guards + 2 unused permissions + privacy/submission artifacts |
| Browser-APIs-that-throw + async-acquire-leak | clean | `useLiveCoaching` guards getUserMedia/AudioContext/unmountedRef/MediaRecorder |
| Context-switch state-bleed | **guarded** | `key={id}` on SessionCoachTools (`717be56e`) |
| Append-only double-write | **4 FIXED** (was reported 2; A29 re-sweep 2026-08-08 found 2 more — the earlier "other POSTs are idempotent" claim was UNDER-SWEPT) | useRef latch on `submitWhy` (`9463f709`), `generateReview` (`63b13084`), **`[id]`-page `recordOutcome` (`24bf8ecc`, build xl)**, and **after-pitch-page `recordOutcome` (`bbe22e06`)** — all button-triggered submits that POST append-only §3.1 events (`/why`, `/review`, `/outcome`) with only a `useState` guard (bypassable by a fast double-click before re-render). See the swept-boundary baseline below. |
| Unbounded `.select()` 1000-cap | live, **founder-gated** | `kpi/me` + `compute-cron:71` (.limit(5000)=false bound); fix = RPC in the founder-gated KPI subsystem |
| UTC-today-in-browser | clean | no browser day-truncation in the sales-coach client |
| Money float-precision | clean | `sumDollarsExact` (integer-cent staging); no money `a*b` |
| LLM injection-fence | clean | every transcript engine fenced (CONVERSATION_IS_DATA or bespoke inline); debrief reads the user's OWN messages |
| Tenant-scope (cross-tenant writes) | clean | INV15 gates coaching_sessions; `why`→events + `compute-cron`→kpi_snapshot both pin company_id |
| Signed-URL bearer capability + INV19 | clean | `retranscribe` proves company + owner/manager access before signing audio (INV19 owner-check applied by name); recordings list returns no URL, manager+same-company gated |
| CSV formula-injection (CWE-1236) | clean | `toCsv` neutralizes every cell; the KPI/team exports (incl. user-controlled rep names) route through it |
| Bare `void` write dropped on serverless freeze | clean | no fire-and-forget `void asyncWrite()` in any Sales Coach route — every write is awaited |
| On-mount auto-POST double-fire | clean | SessionCoachTools' mount effect has stable deps + a `cancelled` guard |
| Gate-keys-on-reference (cross-user read) | clean | `elo`/`recordings`/`skills` verify a passed `agentId` against the data (self OR manager+same-company), not the reference; owner-private exposure discipline on elo history |

## The honest-empty sweep (the session's largest thread) — 7 gaps

A model failure / empty result rendered to a user as a successful blank, violating the honesty thesis:
1. extension `summarize` · 2. care/extension `summarize` · 3. `coach/sales-session/[id]/ask-coach` ·
4. `care/agent/.../summarize` · 5. `care/agent/.../co-pilot` · 6. `me/ask-jeff` · 7. `coach/sales-session/[id]/summarize`
(the subtler structured-field form: `{summary:null}` 200 → blank panel, no error).

All fixed to fail loud (502) or signal the failure in the client, preserving intentional honest-empty
(hasSignal:false / EMPTY_ / assessment-too-thin) untouched. #1-6 (raw-`.text.trim()` form) found by a
recipe grep; #7 (structured-field form) found by an independent Explore-subagent audit and verified
end-to-end. The `ask-coach` fix carries a detection-tested regression test. Full recipe + findings:
memory `reference_error_dressed_as_no_data_class`.

## Open — FOUNDER-GATED (surfaced, not resolved unilaterally)

1. **KPI unbounded-select (verified live).** `kpi/me` and `compute-cron` fetch `coaching_sessions` unbounded
   (the `.limit(5000)` is a false bound — PostgREST caps at 1000). Past ~1000 sessions the KPI aggregates go
   silently wrong (compute is all-time, ordered oldest-first). Fix = a server-side aggregate RPC in the
   founder-gated KPI/measurement subsystem; the corrected metric can't be validated without live data
   (guide-don't-overtake + distrust-unverified), so
   not auto-fixed. Bites at ~5 reps × 200 calls = 1000 sessions/company.
2. **Full per-table tenant-scope sweep — VERIFIED CLEAN (2026-08-08, later pass).** INV15 gates
   `coaching_sessions`. The originally-flagged tables (`elo_ratings`, `sales_corpus`, `assessments`) turn out to
   have **no direct app writes at all** (grep-confirmed) — they're computed/derived from `events` or were
   speculative names — so there's no admin-write cross-tenant surface on them to audit. The actual admin-write
   path is `events` (append-only): ALL Sales Coach event-write routes verified (review/decision/v5-analyze/
   v5-debrief/v5-grade-sent → `getCurrentCompanyId()`; voice → profile.company_id+gate; after-pitch →
   session.companyId+same-company; why → getSession/INV19; v5 lib fns → args.companyId from these auth contexts)
   — all pin `company_id` from
   **server-derived context** (session/getSession — INV19 owner-checked — or the calling route's auth context),
   never from client input (client supplies only payload content). `coach-assessment` computes from `events`
   tenant-scoped (`.eq("company_id", ctx.companyId)`). A *complete* every-event-insert provenance audit across
   the whole app remains the `/code-review ultra` scope, but the Sales Coach admin-write surface is read-confirmed
   clean here — no cross-tenant write gap.
3. **Extension launch decisions** (entitlement source, icon, error-detail policy, privacy review, screenshots,
   `NEXT_PUBLIC_SALES_EXTENSION_ID`) — see `SALES-COACH-EXTENSION-STATUS.md`.

## Append-only double-write — swept boundary (A29/A26 baseline, 2026-08-08)

Class: *a button-triggered handler POSTs to a route that appends an immutable §3.1 event, guarded only by a
`useState` busy flag (which disables the button on the NEXT render) — a fast double-click appends duplicate
immutable events.* The precise gate is semantic (which handlers append? call-graph) so it's ungated (A33); the
real chokepoint would be server-side event idempotency (a §3.1 event-model decision, founder-gated).

- **FIXED (4):** `submitWhy`, `generateReview`, `[id]`-page `recordOutcome` (xl), after-pitch `recordOutcome`
  (`bbe22e06`) — all `useRef`-latched. The outcome ones are the highest-impact (they feed the downstream-
  consequence KPI).
- **RECORDED, LOW impact, not fixed:** `sessions`-page `refreshPatterns` → `/why-patterns` → `storeWhyPatterns`
  appends a `PATTERNS_KIND` event per call, guarded only by `patternsBusy` (useState). It's a **cache** (reader
  takes the latest set), so a duplicate is harmless unless a metric ever COUNTS pattern-set events. Same
  `useRef`-latch fix if desired.
- **ASSESSED cross-product — LOW impact, no fix needed:** read-audited the v5/C.A.R.E callers. `CoachPanelV5`
  (flagship) is CLEAN — auto-analyze is debounced + uses `abortRef` (cancels the in-flight request) +
  `lastAnalyzedDraftRef` (dedups), a *more* robust pattern than the latch. The other surfaces
  (`ReviewSentMessageModal`, `dashboard/chats/[id]`, `ConversationsApp`) POST `/v5/analyze` / `/v5/debrief`,
  which write **cache events (latest-wins)**, not a consequence metric — so even an unlatched double-fire yields
  a harmless duplicate the reader ignores (same low-impact posture as `why-patterns`). **No high-impact
  (consequence-metric-feeding) double-write exists outside the fixed `/outcome` instances.** Residual: fully
  tracing each cross-product trigger (button vs auto) is genuinely low-value given the cache semantics —
  `/code-review ultra` scope if ever a cross-product event starts feeding a counted metric.

## Method note

The through-line: **distrust every "done"/"clean"/"defer," run the definitive check, but diagnose each
suspect before acting.** It surfaced 20+ real gaps AND prevented every false fix (a "CWE-209" that was an
intentional convention → reverted; liveCue/debrief that looked unfenced but weren't; a localhost "leak" that
was a comment; an origin count that was RCD; a determinism overclaim). Real fixes landed only where read-
confirmed; the in-app Sales Coach code proved well-built, the extension *port* was where guards got dropped.
