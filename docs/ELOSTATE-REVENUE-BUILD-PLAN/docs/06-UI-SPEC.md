# 06 — UI spec

Uses the app's semantic tokens (`bg-surface`, `text-primary`, `border-default`, `text-brand`; theme audit). Layout follows Gong's deal board and account screens (#1011 pipeline board, #1555 deal rows, #1567 account UI, #1000 deal list and engagement feed).

## Accounts (Phase 1)
- **List:** search box and a "Mine / Team / a rep" picker (the same as Pipeline). Columns: Account · Open deals · Open amount · Last call · Contacts · Activity (Phase 4; until then the column is absent, not empty). A row opens the account.
- **Account page:**
  - header with the name (editable) and open/won/lost totals;
  - **Timeline:** calls, deal changes and tasks, newest first, each with a link;
  - **Deals:** each one's stage, amount and close date;
  - **Contacts:** name, title, rank chip, last call.
  - "Ask about this account" arrives in Phase 5.
- **Deal panel (Pipeline):** an Account field (pick or create), and a Contacts section (add with a role, remove).
- **Call page:** a "Who was this?" box beside the customer speaker. Choose a contact, or create one on this call's account.

## Deals (Phase 2–3)
- **Board:**
  - tabs Open · Won · Lost, kept from today, plus saved views;
  - filters for rep, stage, close period, account and warning;
  - columns: Deal · Account · Stage · Amount · Close · Last call · Next call · Contacts · Warnings (chips) · Playbook letters · To do;
  - roll-ups (count and amount) per tab.
- **Panel tabs:** Overview · Warnings (each with its reason and mitigation) · Contacts · Activity · Playbook · Brief.
- **Playbook letters:**
  - empty: outlined;
  - AI found evidence: outlined with a dot;
  - noted: filled light;
  - validated: filled brand.

  Each state also has a text label (accessible).

## Win/loss and drivers (Phase 4)
Below the minimum, the page says "Win/loss needs 100 closed deals. You have N." and shows no bars.

## Forecast (Phase 6)
A grid of people by columns, roughly Commit / Best case / Pipeline / Closed / Target. Clicking a cell opens the submit panel, which shows the last submission, the deals behind the number, and progress to target.
