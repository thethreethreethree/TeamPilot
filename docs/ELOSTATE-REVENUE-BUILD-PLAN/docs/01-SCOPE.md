# 01 — Scope

**What's built:** the revenue stack Gong sells and EloState lacks, in this order (founder picker, 2026-11-27, "Deals + accounts first"):
1. Accounts and contacts
2. Deals
3. Deal warnings, playbooks and the AI deal reviewer
4. Win/loss and deal drivers
5. Ask Anything across calls, deals and accounts
6. Forecast
7. Engage (sequences and dialer)
8. CRM sync, API and MCP, then agents

This plan details steps 1–6. Steps 7–8 get their own plan once 1–6 are standing, because each is a product of its own.

**Source:** the Gong teardown (`reference/gong-teardown.json`, M20 Deals, M21 Accounts, M22 Forecast, M29 CRM) and the Gong Capture Evidence report (#1011 #12 #1555 Forecast and pipeline UI, #1010 Revenue AI, #14 Ask Anything, #1567 account UI).

## Entities and lifecycle

| Entity | States | Who changes it | What must be true first |
|---|---|---|---|
| Account | exists → (renamed / merged) | a rep or manager who can see one of its deals or calls | a name; no other account in the company with the same key (`accountKey`) |
| Contact | exists → (title / account changed) | the same people | a name; it belongs to one account or none |
| Deal (= prospect, R1) | open → won · lost (and back to open) | the deal's rep; their manager in the tree | today's prospect rules |
| Deal stage | ordered list per company | admins | — |
| Warning | raised → cleared | the nightly job only (no person writes one) | an open deal |
| Playbook note | empty → ai_found → noted → validated (`rules.ts transition`) | AI suggests; the rep writes; the owner or manager validates | the deal has a playbook |
| Forecast submission | appended per period | rep / manager on their own row | a board and a period |

Everything is append-only (§3.1). An account's or contact's name is an event. A warning is a raise event and a clear event. A playbook note is an event.

## Roles

| Role | Can |
|---|---|
| Rep | see and edit their own deals, the accounts and contacts on them, and their own playbook notes |
| Manager | everything a rep can, for every rep under them (`rss_tree_allows`); validate notes; see drivers and win/loss for their tree |
| Admin | the stage list, warning thresholds, playbook choice |

## What carries across
The prospect: its events, calls, tasks, close date, source, erasure (0323), tree RLS, Ask-across-pipeline, and the market view of how deals go when a competitor comes up.

## What doesn't
- The free-text `organization` stays as history. Accounts are built from it once (Phase 1 backfill), and from then on the deal points to an account.
- No CRM fields (R2).
- No email (R7).

## What "done" means for steps 1–6
A manager opens Deals and sees their team's open deals, each with its account, contacts, stage, amount, close date, warnings and playbook letters. They open one and read its timeline of calls, its AI notes and the lines they rest on. They open the account and see every deal and call with it. They submit a forecast and see how accurate last quarter's was. None of it shows a number the data can't support.
