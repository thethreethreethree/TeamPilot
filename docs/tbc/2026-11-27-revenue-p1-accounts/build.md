# BUILD - Revenue Phase 1: accounts and contacts

Migration 0370 (accounts, account_events, contacts, contact_events, deal_contacts, call_contacts, their current views,
remote_prospect_events kind 'account', remote_prospects_current.account_id last, find-or-create / rename / create-contact
functions, backfill, erasure). No env keys.

### A rep sets a deal's account
write-path: Pipeline deal panel → POST /prospects/:id {action:"account", name} → rss_account_find_or_create (key + lock in SQL) → an 'account' event through the caller's client.
read-path: GET /prospects/:id → account {id, name}; the account page lists the deal.

### A rep creates a deal with a company
write-path: POST /prospects {organization} → rss_create_prospect, then find-or-create → 'account' event.
read-path: the account page.

### Contacts on a deal
write-path: AddContact → POST /contacts (rss_create_contact, invoker) → POST /prospects/:id {action:"contact", role} → deal_contacts row.
read-path: GET /prospects/:id → contacts with rank; the account page's Contacts.

### Who was on a call
write-path: CallContacts on the call page → POST /:id/contacts {contactId, linked} → call_contacts row.
read-path: GET /:id/contacts.

### Accounts list and page
write-path: rename → POST /accounts/:aid → rss_account_rename (409 on a name the company already uses).
read-path: GET /accounts?scope= and /accounts/:aid → list with roll-ups; one timeline of calls, deal changes and to-dos.

### Erasure
write-path: Protection → erasure find (rss_erasure_contact_matches) → erase (rss_erase_contacts; rss_erase_sessions renames contacts on erased calls and accounts only erased deals were on).
read-path: the renamed contact or account reads "(erased on request)".
