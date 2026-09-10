# 03 — Admin full-transcript view

**What it is.** A manager can open **any rep's** coaching session and expand the **full, speaker-labeled
transcript** (Rep vs Customer turns) — for testing and feedback. A rep can read their own; a peer sees nothing.
9/2 partner-meeting request #3. (The consent checkbox raised in that meeting was deliberately NOT added — it
contradicts the standing 2026-08-18 direction that recording consent is already handled.)

**App work: render a new endpoint (RLS does the gating).**

## Web source of truth
- Endpoint: `GET /api/coach/sales-session/[id]/segments` — caller-scoped; 401 if unauthenticated; reads
  `coaching_transcript_segments` `select("speaker, text, seq, spoken_at").eq("session_id", id).order("seq")`;
  returns `{ segments }`.
- RLS (migration `0084`): a SELECT is allowed to the session's **owner** (`agent_id = auth.uid()`) OR a
  **same-company manager** (`role in CEO/COO/admin OR sales_coach_role='admin'`). An unauthorized session
  returns **zero rows** — a peer sees an honest empty, never another rep's transcript.
- Web UI: `src/components/sales-coach/SessionTranscript.tsx` — a collapsible "Full transcript" that lazy-fetches
  on expand and renders Rep(green)/Customer(blue)-labeled turns. Placed on the session detail screen.
- The sessions LIST already shows managers the whole company's sessions (staff see only their own), so a manager
  reaches any rep's session and expands the transcript.

## Data contract
```
GET .../[id]/segments → { segments: [ { speaker: "agent"|"customer"|"unknown", text, seq, spoken_at: string|null } ] }
```
- `speaker: "agent"` = the Rep; `"customer"` = the Customer.
- Empty `segments` = either no transcript captured OR (for a peer) RLS returned nothing — render "No transcript
  captured for this session." either way; do not distinguish (the RLS empty is by design).

## UI to build (native)
- On the session detail screen, a collapsible **"Full transcript"** row. On first expand, fetch the endpoint.
- Render each turn: a small uppercase label — **Rep** (emerald) or **Customer** (sky) — then the text.
- 401 → not-signed-in; error → "Couldn't load the transcript" + Retry; empty → "No transcript captured".
