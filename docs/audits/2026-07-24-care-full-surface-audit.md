# C.A.R.E full-surface audit — 2026-07-24

**Scope (founder directive):** "a complete audit of the C.A.R.E system — every feature,
every button, every user interface, every part of the system including the ones I did not
mention." Trigger: the Assign button was reported dead and the prior audit (largely static)
missed it. This audit therefore explicitly targets the **"looks wired but doesn't actually
work"** class (dead handler / wrong route / click-block / dead-intent param / buried overlay)
and light-mode contrast, per AMD-006 L2 + the 3rd addendum (an audit is not complete at
"code reads correctly" — it must reach Layer 2 or be labelled static-only).

**Method:** every interactive control traced control → handler → route (method verified against
the actual `route.ts`) or state change; findings verified at file:line before fixing; Layer-2
evidence via headless repros where the authed app couldn't be run in this environment.

---

## Surface coverage

| Cluster | Files | Verdict |
|---|---|---|
| Dashboard pages | analytics, coach-assessment, customers, growth, knowledge, leadership, leadership/readouts, monitor, patterns, home (10) | wiring sound; 1 dead-intent param fixed |
| Settings | settings, account, agents, shortcuts, tags, widget + SettingsTabs (7) | **CLEAN** — every Save/Add/Delete → real route+method |
| Customer/agent widgets | CareChatWidget, CareEmbeddedWidget, CareShell, HandoffCard, ReadPhasePanel, ResolutionCaptureModal, VoiceSurface (7) | 1 launcher dead-corner fixed; rest clean |
| Primary agent surface | ConversationsApp (~4600 lines) — toolbar, composer, panels, dropdowns, list | 4 defects fixed (1 HIGH) |
| Demo | care/demo/page, CareShowroom, JeffLiveChat, CareAgentBenefits, CareHonestNote | CLEAN; 1 founder-TODO (BOOKING_URL) |
| API routes | ~55 `route.ts` under `/api/care/**` | all referenced routes exist with correct HTTP methods |

---

## Findings & fixes (all committed + pushed; tsc + build + 1381 tests green)

### THE Assign bug — portaled dropdowns buried behind the shell (real root cause)
`FloatingMenu` portals to `document.body`; the C.A.R.E surface renders inside `CareShell`
(`fixed inset-0 z-[60]`, opaque bg). Assign/Priority dropdowns at `z-50` opened **invisibly
behind** the shell → "nothing happens at all". The two prior `relative z-10` toolbar fixes
were the wrong layer (§0.2 error loop). Proven in a headless repro (`elementFromPoint` at the
z-50 menu = the shell; at z-70 = the menu item).
**Fix + §A26 class sweep:** Assign/Priority → z-70; CareShell status picker → z-70;
MentionInput autocomplete → z-90 (buried inside z-80 FeedbackPanel). ExportMenu left at z-50
(plain pages, safe). LearningHint already z-70 (safe). Commit `ad3b46a5`.

**Validated z-index ladder (care):** customer widget 55 < CareShell 60 < dropdowns/toast 70 <
resolution modal 80 < mention autocomplete 90. Coherent, no remaining mis-stacked element.

### HIGH — cross-conversation mis-send (ConversationsApp)
`draft` (+ AI provenance + note-mode) was shared state reset only on send/apply, never on
conversation switch → an unsent reply to A could be **sent to B's customer**. Fixed: reset in
the `selectedId` effect. Commit `ed603f73`.

### MEDIUM — Coach inert on closed conversations
Coach grades a draft; no composer exists on closed conversations, but the Coach button lacked
the `status !== "closed"` guard → clicking focused a null ref + pointed the hint at a
non-existent composer. Fixed: guarded like the composer. (I introduced this promoting Coach.)
Commit `ed603f73`.

### LOW — fixed and verified
- Embedded-widget launcher **dead corner**: unread dot (absolute sibling) ate taps on the
  button's top-right ~12px → `pointer-events-none`. Commit `d189c4e1`.
- Patterns **dead-intent deep-link**: home linked `?category=` but the page ignored it → read
  it client-side + highlight/scroll the matching pattern. Commit `d189c4e1`.
- Coach hint toast **light-mode contrast** (`text-arc-200` on light) → theme-aware. `d189c4e1`.
- Two overlays without `pointer-events-none` (list search icon, hint toast). `ed603f73`.
- Detail column could **crush to a sliver** at narrow widths → `md:min-w-[380px]` floor. `539b3c4c`.

### Verified CLEAN (not bugs)
CareShell status label emerald-300/amber-300 (always-dark sidebar, correct); all settings
routes/methods; all widget callback props receive real functions; Assign/Priority menus
portal correctly (not clipped); CustomerPanel is a flex sibling (clips, not an overlay);
`acting` cannot get stuck (finally resets it).

### Founder-TODO (not a code fix)
Demo "Book a demo" CTAs point at `BOOKING_URL = "/login"` placeholder (`care/demo/page.tsx:36`)
— a login wall for anonymous prospects. Set a real booking link before sending to prospects.

---

## Runtime verification checklist (founder — Layer 2, can't self-serve in this env)

- [ ] **Assign**: clicking Assign opens the agent menu and an agent can be selected + persists.
- [ ] **Priority** dropdown and the **sidebar status** picker also open (same fix).
- [ ] Switching conversations **clears the composer**; Send only ever sends the *current*
      conversation's text.
- [ ] **Coach** is hidden on closed conversations; works on open ones with a draft.
- [ ] Light mode: the Coach hint and semantic text are readable; detail panel doesn't crush.
- [ ] Embedded widget launcher opens when tapped on any corner (incl. the unread-dot corner).

*On the record per §1.7.4. Compare future care audits against this baseline.*
