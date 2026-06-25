# Closure: End-of-conversation Coach debrief (both surfaces)

**Date:** 2026-06-24
**Builder:** Agent
**Founder directive:** "add a feature at the very end of every conversation, it gives you a summary of what you learned and what you need to work on. Since elostate teaches the person after every back and forth message." Founder chose **both surfaces** (Team Chat + C.A.R.E).

## What this is

A two-part teaching debrief the Coach produces when a conversation **ends** — what the user did well, and their current growth edge — aggregating the per-message coaching that already happens into one closing moment. Builds on the existing Coach v5 (Auto-Coach + grade-sent + cross-conversation memory); it does not replace per-message teaching, it caps it.

## Understanding gate (§0 / §1.5.1) — what I verified BEFORE building

1. **Existing Coach maps the need.** Coach v5 already teaches per-message (`grade-sent` → grades; `memory.ts` → cross-conversation patterns). The debrief *aggregates* this, not reinvents it.
2. **§A14 data-path check (the make-or-break).** The debrief needs per-conversation coaching data:
   - `coach.message_graded` events ARE conversation-attributable: grade-sent stores `subject: "chat_topic:<UUID>"` + `message_id` ([page.tsx:489](../../src/app/dashboard/chats/[id]/page.tsx#L489)); C.A.R.E grades sit inline on `support_messages.coach_grade` ([care.ts:136](../../src/lib/data/care.ts#L136)). ✓
   - `coach.analyze_returned` events are NOT (analyze route strips the id — [analyze/route.ts:337](../../src/app/api/coach/v5/analyze/route.ts#L337)). This **shaped the architecture**: the debrief is **Coach-LLM-generated from the user's actual messages + grades**, not assembled from analyze events. This grounds it in real text (§3.4 no fabrication) and sidesteps the id gap.
3. **No schema migration needed** — all source data exists; the debrief is emitted as a generic `coach.debrief_generated` chain event.

## Architecture (one engine, two surface presentations)

- **Engine:** [src/lib/coach/v5/debrief.ts](../../src/lib/coach/v5/debrief.ts) — `generateConversationDebrief({surface, conversationId, userId, companyId})`. Gathers the user's OWN authored messages + grades per surface (reusing `fetchMessages` / `fetchAgentConversation` — DRY), loads cross-conversation memory, calls the LLM, parses. Never throws (a debrief failure must never block the close/resolve).
- **Prompt:** [src/lib/coach/v5/debriefPrompt.ts](../../src/lib/coach/v5/debriefPrompt.ts) — KB-grounded; "workOn" anchored to grades (§3.5), honest-empty when clean (§3.4).
- **LLM helper:** `debriefCoachV5` ([claude.ts](../../src/lib/claude.ts)), maxTokens 700.
- **Endpoint:** [/api/coach/v5/debrief](../../src/app/api/coach/v5/debrief/route.ts) — POST generates + emits the chain event; GET reads back the stored debrief (no regen on revisit).
- **Card:** [CoachDebriefCard](../../src/components/coach/CoachDebriefCard.tsx) — presentational, used by both surfaces.

### The key §1.5.1 layer-3 decision: inline card vs overlay

The two surfaces have **different end-of-conversation workflows**, so the same card is composed differently:

- **Team Chat** closes a topic and the closed topic **stays on screen** → the debrief renders **inline** under the close banner ([page.tsx](../../src/app/dashboard/chats/[id]/page.tsx)).
- **C.A.R.E** resolve **auto-advances to the next conversation** (the resolved one drops out of view — [ConversationsApp.tsx:1598](../../src/components/care/ConversationsApp.tsx)). An inline card would **never be seen**. So the debrief surfaces as a **dismissible overlay** that pops after resolve while auto-advance proceeds underneath.

This is the §1.5.1 trap the constitution names (the Close-without-auto-advance incident): a feature can be technically complete and still break the workflow it lives in. An inline C.A.R.E card would have been "done" but invisible. The overlay respects BOTH the auto-advance continuity AND §3.6 (make learning visible).

## Outside-perspective audit (four personas) — run inline before commit

### Persona 1 — the person being coached
- Team Chat: close → "Your debrief" card appears inline; they read, move on. Flowing.
- C.A.R.E: resolve → overlay pops, auto-advance underneath → read → "Got it" → already on next conversation. Respects the auto-advance fix.
- Honest empty state: clean conversation → Team Chat shows nothing; C.A.R.E overlay closes itself. No fabricated lessons (§3.4).

### Persona 2 — engineer
- One engine + one card + two presentations; reuses existing fetchers. Clear.
- **Honest concern:** the C.A.R.E overlay briefly flashes open→closed when a resolved conversation has no agent-authored signal (loading modal then auto-close). Minor; acceptable.

### Persona 3 — adversary
- Cross-conversation read: engine uses RLS-scoped clients (`fetchMessages`/`fetchAgentConversation` both use the server client, [chats.ts:570](../../src/lib/data/chats.ts#L570) / [care.ts:436](../../src/lib/data/care.ts#L436)) — a user can only debrief what they can already read. Empty otherwise.
- Event insert is user-scoped + RLS-gated (same pattern as analyze/grade-sent).
- Self-injection via own message content: the debrief is shown only to its author — no privilege gain; output rendered as text, not HTML (no XSS).
- Rate limited 20/min.

### Persona 4 — CFO
- One LLM call per close/resolve, gated by ≥2 authored messages; read-back avoids regen. KB-in-prompt cost consistent with existing Coach (§7.2 "tokens are investment"). Moderate, acceptable.

## A21 cross-module
- `coach.debrief_generated` is additive; nothing else consumes it. `loadCoachMemory` reads only analyze/graded kinds — no interference. Subject convention (`<surface>:<uuid>`) matches grade-sent.

## A14 render-branch walkthrough
| Branch | Team Chat | C.A.R.E |
|---|---|---|
| has signal | inline card | overlay + card |
| loading | inline loading card | overlay loading |
| no signal | renders nothing (gate fixed: `debrief?.hasSignal \|\| loading`) | overlay closes itself |
| revisit | GET read-back → card (no regen) | n/a (transient overlay) |

**Gate bug caught + fixed in this pass:** the Team Chat gate initially rendered an empty padded container on the no-signal branch (`debrief` is a truthy `{hasSignal:false}` object). Fixed to `debrief?.hasSignal || debriefLoading`.

## Honest scope limits (stated, not hidden)
- **Team Chat debrief is for the CLOSER** (close is admin-only) — their own messages. Other participants don't get their own debrief in v1. A per-participant debrief is a future enhancement.
- **C.A.R.E debrief is for the resolving agent** — their own messages. If a different agent resolves than authored, the overlay finds no signal and closes.
- Debrief covers the user's authored messages only — by design ("what YOU wrote"), and the honest framing of "your debrief".

## Verification
- [x] `npx tsc --noEmit` green
- [x] `npm run build` green
- [x] §A14 data path verified against real callers (not assumed)
- [x] 4 personas walked; 2 findings caught + fixed inline (empty-container gate, verified grade subject)
- [x] No schema migration; chain-event-native

## NOT verified (needs founder runtime check)
- The actual LLM debrief quality/tone on a real conversation (can't see LLM output without running). The prompt enforces honesty + peer voice + grade-anchoring, but the founder should read a real debrief and confirm it teaches rather than lectures.
- Pixel rendering of the inline card (Team Chat) + overlay (C.A.R.E).
