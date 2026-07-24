# Session closure — 2026-07-24 (#2) · THE Assign bug root-caused + full C.A.R.E audit + class sweeps

One-page record. Detail lives in the linked docs; this is the map + the decision list. Everything below is
committed + pushed to `main`, tsc clean, build green, **1384 tests** (added 3 guard tests this session).
Commits `99a1d895` → `ba9ca077`.

## 1. THE Assign bug — real root cause (after two wrong-layer fixes)

Founder: *"I still can't assign."* Root cause was **z-index, not click-blocking**: `FloatingMenu` portals to
`document.body`; the C.A.R.E surface renders inside `CareShell` (`fixed inset-0 z-[60]`, opaque bg). The
Assign/Priority dropdowns at `z-50` opened **invisibly behind the opaque shell** — not visible, not clickable
("nothing happens at all"). My two earlier `relative z-10` toolbar fixes were the wrong layer — a §0.2 error
loop I should have broken sooner (the tell: the button was clearly visible + unobstructed in the screenshot,
which already falsified click-blocking).

- **Proven**, not assumed: headless `elementFromPoint` repro — z-50 topmost = the shell (buried), z-70 = the menu.
- **Fix + §A26 sweep** (`ad3b46a5`): Assign/Priority/CareShell status picker → z-70; MentionInput autocomplete
  (inside z-80 FeedbackPanel) → z-90; ExportMenu safe (plain pages); LearningHint already z-70.
- **Class closed app-wide:** verified the other z-[60] shells — SalesCoachShell (no portaled dropdown),
  AskJeffPanel (already z-70, comment shows the lesson was learned there). The bug hides nowhere else.
- **Regression-guarded:** `care-dropdown-above-shell-invariant.test.ts` (`ba9ca077`) fails if any care
  FloatingMenu drops to ≤ shell-z. Memory: `reference_portaled_dropdown_behind_fixed_shell`.

## 2. Two bug CLASSES swept (both HIGH-consequence)

- **Cross-conversation mis-send (HIGH):** composer `draft` (+AI provenance +note-mode) never reset on
  conversation switch → an unsent reply to A could be SENT to B's customer. Reset on switch (`ed603f73`).
- **Per-conversation overlay bleed:** ResolutionCaptureModal / TaskRefinementPanel bind `conversationId=
  {selected.id}`; open-then-J/K-nav re-targets the write to the wrong conversation. Close all overlays on
  switch, EXCEPT the debrief (survives resolve→auto-advance by design, §3.6) (`1dd0c25d`). Keyboard `e/r/n`
  also bypassed the closed/resolved guards the buttons have → aligned (`16bc1c9f`).

## 3. Builds + smaller fixes

Coach promoted to the ConversationsApp toolbar (A21, same ask-coach route); Light/Dark toggle exposed +
full light-mode contrast fix (ember-700 token, theme-aware semantic shades). AMD-006 **3rd addendum**
(`36a65bde`): an audit isn't complete at "code reads correctly" — Layer 2 or labelled static-only.
Coach-inert-on-closed, embedded-widget launcher dead-corner, patterns `?category` dead-link,
detail-panel `md:min-w-[380px]` floor, 2 click-block overlays.

## 4. Audits (on the record) — all CLEAN or fixed

- **Full UI surface** (`docs/audits/2026-07-24-care-full-surface-audit.md`): 21 dashboard pages + ~55 routes +
  10 components, 4 verified tracers. Wiring overwhelmingly sound.
- **Authz / tenant-isolation** of the customer-data routes: **CLEAN** — every route tenant-scoped (explicit
  `company_id` or verified RLS under the AUTHED client), no service-role bypass, no IDOR.
- **Runtime classes verified sound:** timer/interval cleanup; customer-widget send/poll reconciliation
  (both widgets guard the poll with `sendingRef`).
- **One latent fail-open** (documented, currently safe): both auth gates are denylists (`status==='removed'`),
  safe only while `profiles.status` ∈ {active,removed}. Guard added: `profiles-status-fail-open-invariant.test.ts`
  (`859c7631`). Did NOT flip the auth semantics unilaterally (§2).
- **App-wide sweep of the context-switch state-bleed class (BEYOND C.A.R.E scope — flagged):** the same class
  found in care was swept across every master-detail surface. FIXED: sales-coach `[id]` composer (`c6fdd63d`,
  latent floor) + chats `[id]` composer (`9f51e80a`, latent floor) — both §3.1 append-only, so unrecoverable
  if a direct item→item nav is ever added. CLEAN (verified, not the class): TaskGateEditor (prop-sync effect +
  route remount), sales-coach manager views (unmount on switch), problems page (create-form). Ran the full
  runtime-bug rigor (state-bleed / overlay / keyboard / effect-races / timers) on sales-coach — otherwise
  clean. Class captured in memory `reference_context_switch_state_bleed_class` (sweep-complete record).
- **App-Router-preservation class — full `[id]`-page sweep (BEYOND scope — flagged):** same-segment `[id]→[id]`
  navigation PRESERVES a page component (no remount), which breaks both directions of per-item state. Found +
  fixed 3 real/latent code sites beyond the drafts above: C.A.R.E `initialId`→`selectedId` not synced
  (`0b67fd47`, **LIVE** — a notification/deep-link to another conversation showed the wrong one); operations
  `GateForm` seeded from `initialTitle` (`e15fcd00`, `key={task.id}`); admin/crm `OverviewTab`/`ContactsTab`
  edit forms seeded from `account` (`7c6755fb`, `key`, latent floor). Every dynamic-segment page checked;
  invite/[code] + widget/[embedToken] are single-use (N/A). Sweep complete.

## 5. OPEN — founder only (nothing else blocking autonomously)

1. **Runtime-verify** the fixes (Layer-2 checklist in the audit doc): Assign menu opens + assigns; switching
   conversations clears the composer + closes overlays; Coach hidden on closed; light mode readable; layout holds.
2. **Decisions:** flip both auth gates to an allowlist now vs. rely on the guard; `BOOKING_URL` demo placeholder.
3. **Still THE launch blocker:** entitlement write-path **A1 + B1** (`docs/feature-specs/ENTITLEMENT-WRITE-PATH-PLAN.md`).

Memory: `project_care_audit_and_assign_fix_2026_07_24`.
