# Mobile Radial C.A.R.E — interaction spec + verification checklist

Founder-designed mobile surface (2026-07-25). Route: **`/care/mobile`** (outside
`/dashboard/care` so it isn't wrapped in the desktop `CareShell`). Component:
`src/components/care/mobile/CareRadialHome.tsx`. "A 5-year-old can operate it."

## Interaction model (as the founder specified)
1. **Tap the glowing center ("Conversations") first** → unlocks the ring. Nothing
   in the ring is active until then.
2. **Swipe up/down on the center** → cycle through the conversation LIST (up = next,
   down = previous). The `N/total` counter shows position.
3. The current conversation card (below the radial) has two real actions:
   **Open to read** (loads the thread in a sheet) and **Reply**.
4. **Ring (3 tools):** Co-Pilot (top), Summarize (left), Ask Coach (right).
   - **Co-Pilot** → drafts a reply INTO the reply sheet (you edit + send).
   - **Summarize** → read-only result sheet.
   - **Ask Coach** → opens the reply sheet; "Ask Coach to check this" grades the
     draft in place with "Use this" to accept.
5. **Top-left wrench ("More tools"):** Dissect (read-only result) + Spawn Task
   (opens the conversation, where the full spawn flow lives).
6. **Bottom nav (functional only):** Home (refresh), Conversations (read current),
   Settings (→ care settings). Tasks/Search were dropped — no route exists.
7. **Reachability:** small screens hitting `/dashboard/care` auto-route here; the
   header "Desktop" control returns to desktop for the session.

## Backend — same engine as desktop (A21/A31)
All tools call the existing agent routes; the mobile screen is a front-end only:
- inbox: `GET /api/care/agent/inbox?enriched=1` (customer name = `customer.name`)
- read: `GET /api/care/agent/conversations/[id]/messages`
- reply: `POST …/messages { body }`
- co-pilot `POST …/co-pilot` → `{draft}` · summarize `…/summarize` → `{summary}`
- ask-coach `POST …/ask-coach { draft }` → `{response:{suggestedRevision}}`
- dissect `…/dissect` → `{dissect}`

The AI's honesty/handoff rules are unchanged — this is presentation only (§3.3).

## RUNTIME verification the founder must do (all UNVERIFIED on-device)
- [ ] `/care/mobile` loads on a phone; tap center → ring lights up.
- [ ] Swipe up/down cycles conversations; the counter changes.
- [ ] Open to read → the thread loads (customer left, agent/AI right).
- [ ] Reply sends; Ask Coach returns a suggestion; "Use this" replaces the draft.
- [ ] Co-Pilot fills the reply with a draft.
- [ ] Wrench → Dissect returns text; Spawn Task opens the conversation.
- [ ] Small-screen `/dashboard/care` auto-routes here; "Desktop" escapes.

## Honest follow-ups (not yet built)
- **Mobile-native Spawn Task** (currently redirects to the conversation).
- **Tune** the swipe threshold + tap/swipe disambiguation on a real device.
- Result sheets for Summarize/Dissect are read-only — no in-sheet "act" yet.
