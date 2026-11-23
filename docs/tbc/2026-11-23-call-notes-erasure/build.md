# BUILD - Call notes, and erasure that reaches every copy of a customer's words

Migration 0316 (applied). No env keys.

### Take notes on a call
write-path: a phone/video call page (full view, live or after; Macro Mode) → CallNotes → "Add note" → POST
/api/coach/sales-session/[id]/notes { body } (the call's rep only; 0316 insert policy) → call_notes (body through
transcriptTextForStorage; at_ms = now − call start when live).
read-path: GET the same route → notes in order with their moment (plays from it) and author; the rep and their
managers (coaching_sessions RLS).

### Erase a customer everywhere
write-path: the existing erasure route → rss_erase_sessions (0316 body): 0285's deletes and blanks, plus call notes,
call briefs + checklist reviews, follow-up drafts, the checklist's and the prospect's Tasks (titles blanked), the
prospect's name and organization (replaced by "(erased on request)"), the feedback-request message, and client
names/excerpts in the call's notifications.
read-path: the erasure result reports each count (call_notes, call_briefs, followup_drafts, prospects_renamed, …).
