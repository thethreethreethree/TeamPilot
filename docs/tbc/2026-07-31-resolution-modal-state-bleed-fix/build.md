# BUILD — ResolutionCaptureModal state-bleed fix

### key the resolve modal on the conversation id

`src/components/care/ConversationsApp.tsx` — added `key={selected.id}` to the `<ResolutionCaptureModal>`
render (with an explanatory comment).

- **write-path:** when the agent switches the selected conversation, `selected.id` changes → React unmounts
  the old `ResolutionCaptureModal` instance and mounts a fresh one → its `useState` form fields
  (`issueSummary`/`whatWorked`/`category`/`error`) reset to their initial empty values. The subsequent
  `POST /api/care/agent/conversations/${conversationId}/resolution` therefore carries the NEW conversation's
  text, never the previous one's — so the append-only resolution record is correct.
- **read-path:** the agent opening the resolve modal for a conversation sees a blank/fresh form (or their own
  in-progress draft for THAT conversation, preserved across close+reopen because the key is unchanged while
  the same conversation stays selected).

Files:
- `src/components/care/ConversationsApp.tsx` — `key={selected.id}` on ResolutionCaptureModal.
