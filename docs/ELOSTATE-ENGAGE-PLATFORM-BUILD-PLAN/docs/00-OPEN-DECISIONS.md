# 00 — Open decisions (READ FIRST)

Nothing below is made up. Each item has a stand-in today: either the work happens without the outside service, or a
screen says plainly that the outside service is off. The rules live in `elostate-engage/src/lib/engage/`.

| # | Decision | What stands in for it today | Cost of changing later |
|---|---|---|---|
| E1 | Email sending for flow steps | **Manual.** The rep opens the drafted email in their own mail app ("Open in email" plus "Copy"), sends it, and marks the step done. Automatic sending waits on Postmark (`POSTMARK_SERVER_TOKEN` + `CARE_EMAIL_HOST_DOMAIN`, both unset in production; `emailConfigured()` is the one check). | Medium. Auto email needs sender verification per rep, sending limits (F26.1) and an opt-out footer (F26.2, whose wording is legal and isn't drafted here). |
| E2 | Rulesets (Gong F24.4) | One fixed set: a reply or a booked meeting finishes the enrolment; an opt-out removes it and blocks re-enrolment; the last step finishes it. | Low. A ruleset table later, with this set as its default. |
| E3 | Call outcomes | Gong's default list (F25.7), in our wording, company-wide. Required on a call step (F25.9). | Low. Custom outcomes would be a company list. |
| E4 | The dialer | **None in the app.** A call step opens the phone's own dialer (`tel:`) and asks for the outcome. A Twilio dialer (F25.1–F25.6) waits on an account, numbers and per-region recording rules. | High. Numbers, carriers and recording consent are a product of their own. |
| E5 | LinkedIn steps | Not built (needs Sales Navigator). | Low. |
| E6 | Who builds company flows | Admins and Sales Coach managers; reps build their own and use the company's. | Low. |
| E7 | Public API auth | Company API keys, created by an admin, stored only as a hash, scoped read-only — plus, DECIDED 2026-11-27 (founder picker), an optional "upload calls" scope that creates a call with its audio for one rep of the company (phase E6). | Medium. OAuth apps (F31.7) come later. |
| E8 | MCP access | Personal keys that act as the user who made them, so they see only what that person can see. | High if loosened. Gong's "shared" org-wide token isn't built. |
| E9 | Agents' run-as user | The agent's creator. It sees only what they can. | High if loosened. |

## Deliberately not built
| What | Why it's interesting | Why it's left out |
|---|---|---|
| Auto email, tracking and branded links (F26.1, F26.2) | Gong's main Engage engine | Needs a configured sender and legal opt-out wording (E1) |
| Twilio dialer, local presence, inbound (F25.1–F25.6) | One place to call from | External account, numbers and per-region consent (E4) |
| Enrich (F26.5) | Contact data | Paid data partners |
| AI flow builder (F24.8) | Fast setup | It comes after flows are used |
| CRM sync (M29) | Keeps a CRM current | No client CRM on record yet (revenue plan R2) |
