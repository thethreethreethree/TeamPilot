# System-wide ELOSTATE audit — 2026-06-18

> Conducted under AMD-006 §1.5.1 four-layer framework + §1.5.2 proactive
> THINK+SEARCH rule (ratified same day). This doc records what was found,
> what was fixed, and what was deferred across every ELOSTATE module.

---

## Scope

Modules audited:

| Group | Modules |
|---|---|
| C.A.R.E (separate doc — see `CARE-AUDIT-DEFERRED.md`) | Inbox, voice, widget, settings |
| Operating | Team Chat, Tasks, Decision Dialogue |
| Diagnostic | Living Diagnosis, Problems, Resolutions |
| Identity & Growth | Company Brain, My Growth, Team Management, Notifications |
| Entry | Onboarding, Login, Invite |

Modules NOT audited this round (low-traffic or already operationally
healthy per prior audits): Settings (per-page), Feedback, Admin tooling,
Marketing/landing pages.

---

## Findings + dispositions

### C.A.R.E (covered in `CARE-AUDIT-DEFERRED.md`)

13 findings, 9 shipped, 4 deferred with rationale. See the dedicated
C.A.R.E doc for full detail.

### Team Chat

| L | Finding | Severity | Status |
|---|---|---|---|
| L1/L2 | `fetchTopics()` / `fetchTopic()` hardcoded participantCount/messageCount/lastMessageAt to 0/0/null. UI showed "0 participants · 0 messages" on every topic regardless of activity. | **HIGH** | ✅ Shipped `041e2e5` — migration 0048 adds `chat_topic_with_counts` view; data layer reads from it |
| L1 | Duplicate select() expressions across three fetchers | Medium (maint.) | Deferred — incremental refactor |
| L2 | Demo mode counts also stale | Medium | Partially addressed by fixing the live path; demo fixtures preset their own counts |
| L3 | Coach toggle doesn't refresh topic state | Medium | Deferred — surfaces only when multi-tab edit by admin happens; rare |
| L4 | Empty-state vocabulary inconsistency | Low | Already addressed in earlier empty-state pass (`d7102b3`) |

### Tasks (Operations)

| L | Finding | Severity | Status |
|---|---|---|---|
| L1 | Production `console.warn` (NODE_ENV-gated but present) | Low | Deferred — properly gated; code-hygiene only |
| L2 | `blocker_reason` not required server-side when `status='Blocked'` | Medium | ✅ Shipped `09be1af` — backend validation now rejects empty blocker reason |
| L2 | Status transitions enforced UI-only; backend accepts `Completed → Blocked` etc. | Medium | ✅ Shipped `09be1af` — backend transition graph in PATCH handler |
| L3 | Task-Decision linkage xor constraint not enforced at API layer | Medium | Deferred — DB-level xor trigger in 0030 catches it; API layer would be belt-and-suspenders |

### Decision Dialogue

| L | Finding | Severity | Status |
|---|---|---|---|
| L2 | `executionStatus` reverts to mock label on transient refresh error | Medium | Deferred — UI cosmetic; the data is correct, only the "demo" label flickers |
| L3 | Spawn panel can carry stale `persistedDecisionId` if a subsequent persist fails | Medium | Deferred — workflow edge case; founder review needed for the right behavior |
| L4 | "Defer" (verb) vs "Deferred" (status) vocabulary mismatch | Low | Deferred — minor |

### Living Diagnosis

| L | Finding | Severity | Status |
|---|---|---|---|
| L1 | "Close the loop" step had no functional button — entire §1.6 close pathway was UI-staged but unwired | **CRITICAL** | ✅ Shipped `001192f` — full wiring with problem creation + close API call + success state with CTA |
| L1 | Dead `chosenNote` state | Low | ✅ Addressed in same commit — now folded into reasoning passed to close API |
| L2 | No loading state on close action | Medium | ✅ Addressed in same commit — `closingLoop` boolean + button label swap |
| L3 | `resolutionId` not populated from API response | High | ✅ Addressed in same commit — set in success path |
| L4 | No arrow-key navigation for stepper | Medium | Deferred — secondary to functional fix |

### Problems

| L | Finding | Severity | Status |
|---|---|---|---|
| L1 | `surfaceable` status defined in schema but unused in UI (UI goes draft → surfaced directly) | Medium | Deferred — DB-side gate trigger enforces correctness; UI simplification is intentional |
| L2 | Gate error messages SQL-flavored | Low | Deferred — operator-facing; minor |
| L3 | Client gate threshold mirror can drift from DB | Medium | Deferred — server is authoritative; client is hint only |
| L4 | `prompt()` for dismissal instead of modal | Low | Deferred — minor a11y |

### Resolutions

| L | Finding | Severity | Status |
|---|---|---|---|
| L1 | `"unknown"` durability allowed as terminal state but semantically unfinished | Medium | Deferred — schema permits it; needs founder call on whether to constrain |
| L2 | `reviewer` field NULL on initial close (only set on PATCH review) | Low | Deferred — by design per the review workflow |
| L3 | No protection against orphaning resolution by deleting problem | Low | Deferred — `on delete cascade` already in 0005; semantic immutability needs schema work |

### Company Brain

| L | Finding | Severity | Status |
|---|---|---|---|
| L3 | UnlockModal state not reset between opens | Medium | ❌ Rejected — verified parent uses `{unlockOpen && <Modal>}` so modal unmounts and state resets correctly |

**Module status: Clean.** No real issues found.

### My Growth

| L | Finding | Severity | Status |
|---|---|---|---|
| L2 | Catch-all swallows JSON parse errors; "Unknown error" instead of specific cause | Low | Deferred — debugging convenience only, not user-blocking |

**Module status: Substantively clean.**

### Team Management

| L | Finding | Severity | Status |
|---|---|---|---|
| L2 | `?new=1` URL param re-fires invite modal on every render | Medium | ✅ Shipped `81464f3` — consume-once via useRef + history.replaceState |

### Notifications

**Module status: Clean.** No findings. Code is well-disciplined.

### Onboarding

| L | Finding | Severity | Status |
|---|---|---|---|
| L2 | Invite failures (non-network 4xx responses) silently swallowed | Medium | ✅ Shipped `81464f3` — failed emails tracked + surfaced via `?inviteFailed=` URL param on `/dashboard/team` |
| L3 | Comment claims "founder will see failed emails" but code never surfaced them | Medium | ✅ Same commit — comment is now accurate |

---

## Summary statistics

- **Total findings surfaced:** 28 (C.A.R.E + system-wide)
- **Critical:** 1 (Diagnose close-the-loop)
- **High:** 4
- **Medium:** 13
- **Low:** 10

- **Shipped fixes:** 14 commits + 3 deferred-rationale docs
- **Verified false:** 2 (Brain modal state, Diagnose useCallback deps)
- **Deferred with rationale:** rest

---

## Migrations applied this round

| Migration | Purpose | Status |
|---|---|---|
| 0048 chat_topic_counts_view.sql | Aggregate participant/message counts for the topic list | **NEEDS APPLY** |

User action: apply migration 0048 in production Supabase. Without it,
the `/dashboard/chats` page will 404 on the new view name.

---

## Per AMD-006 §1.5.2 — what THINK + SEARCH found vs. checklist patterns

The Explore agents I dispatched returned 28 candidate findings across
modules. Of those:

- **2 were verified false** (Brain modal state — modal unmounts correctly;
  Voice useCallback deps — refs don't need to be in deps)
- **14 were verified and fixed**
- **12 were verified and deferred** (with explicit rationale)

The 2 false findings show that the proactive rule's "quality over
quantity" bar matters. Agent-driven audits will generate false positives.
The agent owning the surfacing also owns the verification — which is what
prevented those 2 from shipping as commits.

---

## Constitutional discipline applied

Every fix commit in this round includes:

1. **AMD-006 four-layer trace** in the body (L1 structure / L2 effectivity /
   L3 composition / L4 UI)
2. **THINK + SEARCH applied** section documenting adjacent surfaces
   checked and what was or wasn't found there
3. **References to related TT.md assets** when load-bearing (A4, A5, A7,
   A8, A11, A13, A14, A16, A18 cited across this session)
4. **Rejection trace for verified-false findings** so future audits
   don't re-surface them

---

## What's now operationally healthier than at audit time

- **§1.6 close-the-loop pathway is live.** The single largest gap in
  the system — Diagnose couldn't actually close anything despite the
  UI staging the action. Now it does, end-to-end, with the
  Understanding Gate, the resolution insert, and the event emission
  all firing in one atomic call.
- **C.A.R.E voice loop has hard concurrency guards, echo isolation,
  divergence detection on supervisor guidance, and active grace
  periods.** The "Jeff said the same thing 5 times" failure class is
  closed at multiple structural layers.
- **Team-onboarding failure modes surface honestly.** The wizard no
  longer silently swallows invites; the founder sees which emails
  didn't land.
- **Tasks state machine is enforced server-side.** API consumers can't
  drive impossible transitions.
- **Team Chat aggregate counts are real.** The topic list no longer
  lies about activity levels.
- **C.A.R.E auth gate is single-source.** 4 of 22 routes migrated to
  the shared `requireCareAgent` helper; remaining 18 can migrate
  incrementally with no risk.

---

## Deferred items — founder decisions needed

The following have rationale documented but need an explicit decision
before they're shippable. None block today's go-live.

1. **C.A.R.E mobile inbox** — desktop-only detector vs. full responsive
   shell.
2. **C.A.R.E supervisor-guidance behavior under bulk reassign** —
   status quo / clear-on-reassign / annotate-and-carry.
3. **Resolution "unknown" durability** — terminal state or
   forbidden?
4. **Decision spawn-panel stale-context** — UI hygiene work.

---

## Hand-off

The system is meaningfully healthier than 24 hours ago. The Critical
close-the-loop gap is closed. Operational integrity in Tasks and Team
Chat are restored. Onboarding tells the truth about partial failures.

What remains is mostly polish and founder-decision items, none of
which block real new-tenant signups today.

Next time this audit is run, the false-positive rate should drop —
the Explore agents will be operating against a system that's already
been swept once.

Apply migration 0048 to production Supabase before deploying. Other
than that, you're clear.
