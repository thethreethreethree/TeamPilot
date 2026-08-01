# BUILD — C.A.R.E service philosophy injection

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```

## The single source of truth
`src/lib/care/servicePhilosophy.ts` — new. Exports `SERVICE_PHILOSOPHY`: a trusted directive block
synthesizing the two sources (feel-seen standard; the 6-part reply shape folded to stay short; the
service-recovery clause — own it, tell the truth, no half-measure, hand off for remedies not the AI's to
grant; the take-them-there proactive step). No source names (IP-safe). Explicit deferral to the
identity/honesty rules.

## The five wire-ins (one standard, every reply-drafting surface)
1. `src/lib/care/prompt.ts` — `buildCareSystemPrompt` pushes `SERVICE_PHILOSOPHY` right after
   `buildIdentity(name)`, before product context / tenant guidance / knowledge / tone. Customer-facing
   auto-reply.
2. `src/app/api/care/agent/conversations/[id]/co-pilot/route.ts` — `systemPrompt: SYSTEM +
   SERVICE_PHILOSOPHY + CONVERSATION_IS_DATA`. In-app Co-Pilot.
3. `src/app/api/care/agent/conversations/[id]/formulate/route.ts` — same insert. In-app Formulate.
4. `src/lib/care/toolPrompts.ts` — `CO_PILOT_SYSTEM` = base `+ SERVICE_PHILOSOPHY + CONVERSATION_IS_DATA`.
   Extension Co-Pilot.
5. `src/lib/care/toolPrompts.ts` — `FORMULATE_SYSTEM` = base `+ SERVICE_PHILOSOPHY + CONVERSATION_IS_DATA`.
   Extension Formulate.

In every case the injection fence (`CONVERSATION_IS_DATA`) stays LAST so the untrusted-data boundary is
re-asserted after the philosophy.

## NOT wired (deliberate)
`SUMMARIZE_SYSTEM` — a READ of the thread for an agent catching up, not a customer reply. Reply-shaping
directives would be wrong there. Excluded + asserted-excluded by the guard test.

## Guard
`src/lib/care/__tests__/servicePhilosophy.wiring.test.ts` — asserts a distinctive marker line reaches the
customer-facing prompt + both extension tools; that Summarize does NOT carry it; and (source-level) that
both in-app routes import + apply `SERVICE_PHILOSOPHY`. Fails if a refactor drops it from any surface.
