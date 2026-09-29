# CHECK — a rep who made their own company in the questionnaire can be added by their manager

## Why

The founder's rep onboarding guide (docs/ELOSTATE UPDATE 9-29-2026/EloState-Rep-Onboarding.pdf, page 1) has
a rep sign up, complete the questionnaire, then ask their manager to add them. The questionnaire is
`/onboarding` → `complete_company_onboarding` (0047), which creates a company and makes the rep its admin.
The 2026-09-25 refusal (97218c32) then answered every such add with 409 "already belongs to another team".
[OBSERVED] 0 add-member requests in production in the 5 days since, so no one was blocked yet.

The 09-25 picker framed the cross-company case as moving a rep between client companies. It did not check that
every new rep would be in a company of their own. That framing was the agent's error.

## Ruling (picker 2026-09-29): allow it for solo companies

A person may be added from another company only when that company's member count is exactly 1 — the person
themselves. Any other member means a real team: still 409. A count that cannot be read: 500, nothing written.

## Evidence

- `add-member/route.test.ts`: 11 pass — a real team (3) refused; a solo company added as Member of the manager's
  company; an unreadable count fails closed.
- Mutations on the threshold: `> 0` (refuse all) fails the solo test; `> 100` (allow teams) fails the
  real-team test.

## Findings

No findings beyond the change itself.

## Not opened

No image or graphic asset touched.
