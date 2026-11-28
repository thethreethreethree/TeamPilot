# BUILD - Recommended contacts

### Suggestions
write-path: none to show them; "Add to deal" posts the existing {action: "contact", contactId, role: "other"} event (deal_contacts).
read-path: GET /api/coach/remote/prospects/[pid] returns `suggested` (recommendedContacts through the caller's client; null when the read failed); the Contacts tab shows "Heard on this account's calls, not on this deal".
