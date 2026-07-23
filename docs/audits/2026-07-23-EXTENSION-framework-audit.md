# C.A.R.E Extension — framework audit (2026-07-23, founder-requested)

Audited against CLAUDE.md + AMD-006 + ThinkerThinker.md — **what the framework requires, not general best practice.**
Triggered by two live founder-reported failures: (1) can't type in the Coach/Formulate input box; (2) the Co-Pilot
draft reads in the wrong voice / "not reading the context properly" (it addressed the reply *to* John, the agent).

---

## 0. The standard, quoted (so it's explicit)

**AMD-006 four-layer build-evaluation framework** (`docs/amendments/AMD-006-…md`, lines 164-189, read this session):

> Every build must be considered through these four layers, **in this order** (foundation up):
> 1. **Build structure efficiency** — … is the code organized, the **data shape sound**, the architectural decisions defensible?
> 2. **Operational feature effectivity** — does the feature **actually achieve its operational purpose, end-to-end**? Not "does the unit test pass" — does the feature, **when invoked the way a real user … would invoke it, deliver the intended result**?
> 3. **Synergetic composition** — how does this feature compose with the elements … around it … Does invoking it leave the surrounding workflow intact, accelerated, or broken?
> 4. **User interface and design** — … is the surface clear, accessible, … aligned with the user's mental model?

> **Why the order matters.** Each layer rests on the previous. … Broken structure is not survivable by clever interface design. Broken effectivity is not survivable by polish.

**AMD-006 §1.5.1** (lines 114-116):

> A feature that is technically complete (the code works, the data changes, the API returns 200) but **operationally isolated (works in itself but breaks workflow continuity) is incomplete and must not ship.**

**CLAUDE.md §0 The One Law:** *"…produces confident, well-formed failure — the exact thing this project exists to prevent."*
**CLAUDE.md §3.4:** the System must be honest; the extension "must be the real tool, not a lookalike" (toolPrompts.ts header echoes this).
**TT.md A16** (line 560, read this session): *"every AI tool that produces output on a user-authored surface accepts the findings of every other tool … AND its system prompt has explicit rules for how to weave those findings into its output. **The data flow IS the composition.**"*
**TT.md A19** (line 630): *"the agent shipped … Co-Pilot surfaces that violate A16 … while **citing '§A11', '§A18' in code comments as if those assets had been consulted. They hadn't. The agent had the labels without the content.**"*

---

## 1. Confirmation: actual built files inspected (not memory)

**Read in full, this session, for this audit:**
- `extension/manifest.json`, `extension/background.js`, `extension/config.js`, `extension/adapters.js`, `extension/content.js`
- `src/app/api/care/extension/copilot/route.ts`
- `src/lib/care/toolPrompts.ts` (SUMMARIZE_SYSTEM, CO_PILOT_SYSTEM, FORMULATE_SYSTEM)
- `docs/amendments/AMD-006-system-and-user-flow-tracing.md` (full)
- `ThinkerThinker.md` assets A8, A16, A18, A19 (grep-located + read)

**Tool routes — ALL 6 now read this session (class-check complete, per the founder protocol):**
- `copilot` — role inversion → **FIXED** (2b).
- `summarize` — "what the customer is asking" role-dependent → **FIXED** (role-awareness note).
- `coach` — passed whole thread as `supportCustomerLastMessage {author:"Customer"}` → **FIXED** (→ `recentThread`, `5d942446`). *This was a 4th class site my first pass wrongly assumed safe — caught by reading the route.*
- `dissect` — generic engine prompt + honest degradation + impersonal output → **RESOLVED by 2a** (no change).
- `formulate` — driven by the agent's explicit `intent`, not thread roles → **SOUND**.
- `spawn` — labels the thread `"Customer conversation"` (accurate framing, not a mislabel) + task extraction is role-agnostic → **SOUND**; §3.4 control-gated, draft-only.

**In-app Co-Pilot — inspected, SOUND, and it VALIDATES the fix (2026-07-23).** `co-pilot/route.ts:72-86` labels
every turn from the DB `authorType` ("Customer" / "Agent (you, earlier)" / "AI (earlier auto-reply)" / "System"),
so the in-app tool is structurally immune to the role inversion — it always knows who's who. It even ends with the
SAME `"Draft the next reply."` phrasing (line 179) the old extension copilot used — proving the bug was never the
prompt wording, it was the MISSING ROLE LABELS. The extension gets an unlabeled scanned blob instead; **Fix 2a
reconstructs exactly what the in-app gets for free from the DB.** So the fix direction is confirmed against the
working reference. §3.4 no-drift is accurate: the copilot prompts intentionally differ (documented in
toolPrompts.ts — the in-app grounds on precedents + Coach grades the text-in extension can't see), but the
load-bearing difference was input-labeling, now addressed.

**All 5 in-app tools inspected — SOUND (class-check complete across BOTH surfaces, 2026-07-23):**
- co-pilot — role-labeled from `authorType` (`Agent (you, earlier)` etc.).
- summarize — shared "Role: body" thread formatter (A13 author-once).
- dissect/ask — `formatVisibleThreadForPrompt` (shared role-labeled formatter).
- formulate — intent-driven (agent states what to say), not thread-role-dependent.
- ask-coach — extracts the ACTUAL last customer message (`.find(m => m.authorType === "customer")`) for
  `supportCustomerLastMessage` AND builds a role-labeled `recentThread` `{author, body, timestamp}`. **This is the
  reference for the extension Coach fix** — my fix passes the thread as `recentThread` with the same shape (the
  extension can't cleanly extract "the last customer message" from unstructured text, so it hands the labeled
  thread and lets the coach find it). Confirms the fix is aligned, not invented.

**Conclusion of the class-check (11 tool routes: 6 extension + 5 in-app):** the role-blindness class is
**extension-specific** — it arises only where the tool consumes UNLABELED SCANNED TEXT instead of structured DB
messages with `authorType`. Every in-app tool is sound. The extension fixes (2a role-labels + 2b agent anchor +
Coach→recentThread + Summarize note) bring the extension to parity with the in-app's inherent role-labeling. No
site of the class remains unaddressed in code.

**Still NOT inspected (minor, non-tool):** `/extension/connect` page content, the icons, the download/prebuild
script internals (the build PATH was validated end-to-end; the connect page's own logic was not read).

---

## 2. Findings

### FINDING 1 — CRITICAL — Coach & Formulate input box accepts no typing (Layer 2 failure)

- **File/loc:** `extension/content.js` — the panel mounts in a **closed Shadow DOM** (`host.attachShadow({ mode: "closed" })`, line 41); the input textarea is created in `renderInputForm` (lines 273-288); event handlers exist only for `click` / `mousedown` / `mousemove` / `mouseup` (lines 150-187, 283). **There is no keyboard-event handler anywhere in the file** — no `keydown`/`keypress`/`beforeinput` listener, and nothing calls `stopPropagation()`.
- **Evidence (behavior):** cursor focuses the box (`ta.focus()`, line 282) but characters don't register (founder screenshots, both Ask Coach and Formulate). Mechanism: keystrokes fire on the textarea, bubble as `composed:true` events to the host page's `document`; shadow retargeting makes `event.target` the host `<div>` (not a textarea), so the host email client's global keyboard-shortcut handler doesn't exempt it, treats letters as shortcuts, and `preventDefault()`s them.
- **Clause violated:** **AMD-006 Layer 2 (operational feature effectivity)** — "does it deliver when invoked the way a real user would" → **No.** Coach and Formulate *require* typed input; on keyboard-shortcut host sites (email clients — the extension's primary target) they are fully non-functional. Per AMD-006's ordering, this is a Layer-2 break that **no UI polish rescues**, and per §1.5.1 it "must not ship."
- **Severity:** CRITICAL (two of six tools completely unusable on the flagship surface).
- **Class check (done, not assumed):** the textarea is rendered by ONE function (`renderInputForm`), used by exactly the tools whose config carries `input:` — **Coach** (`config.js:23-24`, `input.key="draft"`) and **Formulate** (`config.js:26-27`, `input.key="intent"`). Both hit. The other four tools take no keyboard input, so they're unaffected by *this* bug. No other text input exists in the panel (connect view has only a button). So the class is exactly {Coach, Formulate} — bounded and both confirmed.

### FINDING 2 — HIGH — Co-Pilot (and Summarize/Dissect) get role-blind context → wrong-voice output (Layer 1 → Layer 2)

- **File/loc:** `extension/adapters.js` — `textFrom(sel)` (lines 21-36) concatenates node text with `\n\n` and **no sender/role attribution**; the Gmail adapter is `extract: () => textFrom(".a3s")` (line 44). The route then sends it raw: `copilot/route.ts:52` — `userMessage: "Conversation so far:\n${conversation}\n\nDraft the next reply."` — with **no agent identity and no turn labels**.
- **Evidence (code + behavior):** `CO_PILOT_SYSTEM` (toolPrompts.ts:32) correctly says *"Draft the agent's NEXT REPLY to the customer,"* but the input is an unlabeled wall of text, so the model cannot tell which turns are the agent's (John's) vs the customer's. Result (founder screenshot 3): the draft opens **"Hi John, … could you send me a screenshot…"** — i.e. it treated John, the agent, as the customer. Founder: *"I'm the one that's responding; the system is not reading the context properly."*
- **Clause violated:** **AMD-006 Layer 1 (build structure — "is the data shape sound?")** — the extracted conversation data shape is **lossy at the foundation**: it discards the sender attribution the task fundamentally needs. Cascades to **Layer 2** (role-inverted, unusable draft) and to **CLAUDE.md §0 / §5** — a fluent, confident, *wrong* answer ("confident, well-formed failure — the exact thing this project exists to prevent"). Also **TT.md A19**: the copilot route comment claims it "runs the same draft DISCIPLINE as the in-app co-pilot" and cites §A18, but the discipline (usable, role-correct output) is not actually enforced — a **label without the content**.
- **Severity:** HIGH (the flagship tool produces confidently wrong output; erodes trust exactly where the product's whole thesis is "no confident-wrong output").
- **Class check (done, not assumed):** the defect is in the shared `textFrom` extraction, so **every** adapter (all 11 in adapters.js) yields role-blind text, AND the **manual-selection** path (`window.getSelection().toString()`, content.js:385) is equally unlabeled. Every ROLE-DEPENDENT tool is therefore affected: **Co-Pilot** (worst — must know who's who to draft), **Summarize** (prompt asks "what the *customer* is asking" — SUMMARIZE_SYSTEM:12), **Dissect** ("find the *customer's* problem"). Formulate/Coach are less exposed (they act on the agent's *typed* words) but still receive role-blind thread context. Not assumed — traced through `textFrom` → every adapter + the selection path.

### FINDING 3 — MEDIUM — 402 "start a trial in your workspace" points at a flow that does not exist (Layer 3 dead-end)

- **File/loc:** `extension/content.js:238` — on HTTP 402 the panel renders *"Upgrade to Pro or start a trial in your workspace."*
- **Clause violated:** **AMD-006 Layer 3 / §1.5.1 workflow continuity** — the copy directs the user to an action (start a trial) that has **no implementation** (the entitlement write-path is the known launch blocker — nothing writes `plan` or `extension_trial_started_at`; see `docs/feature-specs/ENTITLEMENT-WRITE-PATH-PLAN.md`). A user who hits this is dead-ended.
- **Severity:** MEDIUM (only reachable once a tenant is entitled-then-locked; but it's a promised action with no destination). Bound to the entitlement launch-blocker already flagged.
- **Class check:** the only trial-referencing copy in the panel. The same non-existent-flow assumption also lives in the entitlement plan doc (already tracked). Bounded.

### META-FINDING — the A19 pattern is live in this build

Both Finding 2's route header and multiple `content.js` comments cite `§3.4 / §A18 / §A16 / §3.3` as if the disciplines are enforced, while the actual behavior violates them (role-inverted draft; lossy composition). This is exactly the A19 failure: **labels present, content absent.** The fix for Findings 1-2 must make the discipline *structural* (enforced by code/data shape), not a comment.

---

## 3. Remediation plan

| # | Fix | Clause it satisfies | Risk introduced |
|---|---|---|---|
| 1 | In `content.js`, after the panel mounts, add **capturing** listeners on the shadow `root` (or `.panel`) for `keydown`, `keypress`, `keyup`, `input`, `beforeinput`, `paste`, `cut` that call `e.stopPropagation()` (and `stopImmediatePropagation()`), so host-page shortcut handlers never see keystrokes typed into the panel. Scope to events originating inside the panel so global page shortcuts still work elsewhere. | AMD-006 Layer 2 (feature works when a real user invokes it) | Very low. Could theoretically block a host shortcut *while focus is in the panel* — desired. Must NOT `preventDefault` (that would break typing); only stop propagation. **Verification is John's browser test**, not my check (verification discipline). |
| 2a | **Structural (Layer 1):** make the adapters emit **role-attributed turns.** Where the DOM exposes sender identity (Gmail: each message has a sender element near `.a3s`; WhatsApp already has `data-pre-plain-text="… sender:"`), label each turn `Agent:`/`Customer:` or at least `<sender name>:`. Where sender can't be resolved, fall back to the current blob but flag it as unlabeled. | AMD-006 Layer 1 (sound data shape); A16 (data flow IS the composition) | Medium — per-site DOM work, best-effort against third-party markup (same honesty caveat as existing adapters: miss → degrade, never fabricate). |
| 2b | **Anchor (Layer 2), do this first — cheap + high-impact:** pass the signed-in **agent's identity** (name/email — the extension knows it from the session) into the copilot/summarize/dissect calls, and add to `CO_PILOT_SYSTEM`: *"You are drafting AS <agent>. Messages from <agent> are the agent's; never address the reply to <agent>. If you cannot determine who is the customer, ask for a clarifying selection rather than guessing."* | AMD-006 Layer 2; §0/§5 (no confident-wrong output); §3.4 (honest — ask, don't fabricate a role) | Low — prompt + one field. Doesn't fully fix role-blindness on its own but stops the "Hi John" inversion and makes the failure honest (ask) instead of confident-wrong. |
| 3 | Change the 402 copy to match the real mechanism once the entitlement write-path ships; until then, "Your plan doesn't include the C.A.R.E extension — contact your workspace admin" (no promise of a self-serve trial that doesn't exist). | §1.5.1 (no dead-end); §3.4 (honest copy) | None. |
| Meta | For 1 & 2, land a test/enforcement, not just a comment: e.g. a unit test that the copilot user-message includes agent identity + role labels; keep the citation only where the code actually enforces it. | A19 (labels must have content) | None. |

**Recommended order:** Finding 1 (CRITICAL, ~small, unblocks 2 tools) → 2b (cheap anchor, stops the inversion) → 2a (structural labeling) → 3 (copy). 1 and 2b are both low-risk and I can implement immediately on John's go-ahead; **the completion signal is John's live browser test**, not my checks (§3.4 / verification discipline — I cannot confirm a browser fix from here).

## 3.5 Remediation APPLIED — status (updated as built)

| Fix | Status | Where | Commit | Verified by me | UNVERIFIED (needs founder browser) |
|---|---|---|---|---|---|
| **1** keyboard `stopPropagation` (never preventDefault) | ✅ applied | `content.js` (shadow-root listeners) | `35e8ab09` | node --check, store re-validated | typing works on live host; capture-phase hosts (caveat in code) |
| **2b** agent-identity anchor + WHO-IS-WHO rule | ✅ applied (Co-Pilot) | `copilot/route.ts`, `CO_PILOT_SYSTEM` | `35e8ab09` | tsc 0, eslint 0, 1244 tests | stops the "Hi John" inversion |
| **2a** role-labeled turns | ✅ **WhatsApp + Gmail** · ⏸ other 9 held | `adapters.js` (`labeledFrom` + both adapters) | `35e8ab09`, `4c769fc8` | node --check, store re-validated | labels resolve the right sender on live DOM |
| **2b-adjacent** Summarize role-awareness | ✅ applied | `SUMMARIZE_SYSTEM` | `f32c564f` | tsc 0, 182 care tests | correct attribution on live labeled thread |
| **3** 402 copy (no phantom trial) | ✅ applied | `content.js` | `35e8ab09` | — (copy change) | — |

**Held on purpose (not omitted):** the other 9 adapters' labeling (Outlook, Instagram, Messenger, LinkedIn,
Gorgias, Zendesk, Intercom, Front, Slack) — the labeling *approach* is reasoned but unconfirmed against any live
DOM; replicating it to 9 platforms before the founder confirms it works on Gmail/WhatsApp would fabricate
confidence at scale (§3.4). Rolls out in one pass once the approach is browser-validated on one channel.

**Dissect — RESOLVED by 2a, no change needed (corrected 2026-07-23 after reading the actual engine).** I initially
flagged the shared `generateConversationDissect` engine for a role-awareness pass. Reading `src/lib/dissect/engine.ts`:
`DISSECT_SYSTEM` is GENERIC ("the user has pasted a CONVERSATION … understand the PROBLEM inside it" — not
internal-team-specific), `generateConversationDissect` feeds `sourceText` straight into the prompt (line 255) so
the 2a labels flow through automatically, it degrades honestly (`hasSignal:false` on sparse input), and its output
is impersonal (problem / root-cause / guiding-question) — it has NO wrong-voice inversion failure mode. So Dissect
needs no prompt edit; 2a covers it. (Over-flag corrected rather than left vague or "fixed" for appearances.)

**Source of truth for loading:** `extension/` (my edits); `store/dist/` + the zip are git-ignored build artifacts
regenerated by `build-store-package.mjs`.

## 4. What I did NOT do
- Did not inspect the 5 non-copilot server routes in full, nor the dissect/coach/spawn prompts, nor the in-app tools (so I have NOT verified the §3.4 "no-drift" claim, nor whether Summarize/Dissect have their own role handling). Listed, not assumed clean.
- Did not run the extension (cannot, from here) — Findings 1 & 2 mechanisms are code-evidenced + screenshot-corroborated but the *fixes* need John's browser confirmation.
