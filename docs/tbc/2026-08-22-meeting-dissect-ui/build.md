# BUILD — Meeting Dissect review UI (human-facing)

### Post-meeting review
- write-path: `MeetingReview` POSTs `/api/coach/meeting-session/[id]/dissect` on mount (fetch-or-generate); the
  route stores the dissect event.
- read-path: renders the meeting's CONSEQUENCES — decisions, action items (owner chip, or an amber "no owner"
  flag), open items, an effectiveness dot+note, and the overall — with honest analyzing / pending-audio(409) /
  error / empty states, each retryable.

## Files
- `src/components/sales-coach/MeetingReview.tsx` — the client review component (theme tokens; handles the event
  payload's snake_case `open_items` AND the route's camelCase `openItems`).
- `src/app/dashboard/meeting-coach/[id]/review/page.tsx` — hosts it.

## Reuse
Consumes the dissect route + payload; theme tokens (text-primary/secondary/muted, bg-surface, border-default,
emerald/amber semantic accents). No sales/server change.
