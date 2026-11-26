# 01 — Scope

The revenue stack's remaining products, in the founder's order (picker, 2026-11-27): **Engage**, then **CRM, API and MCP**,
then **agents**. Sources: `../ELOSTATE-REMOTE-SALES-BUILD-PLAN/BUILD-PLAN/reference/gong-teardown.json` M24–M27, M31 and
M32, and the evidence report's Engage, Agents and Revenue Graph pages (#1014, #1004, #988, #1012).

## Entities
| Entity | States | Who changes it |
|---|---|---|
| Flow | live → retired | managers (company flows), anyone (their own) |
| Enrolment (a contact on a deal in a flow) | active → paused ↔ active → finished · removed (`applyAction`) | the deal's rep or their manager |
| Step activity (done, skipped, outcome, note) | appended | the same |
| API key | live → revoked | admins |
| Agent | enabled ↔ disabled; runs appended | managers |

## What "done" means
A rep opens Engage and sees today's steps across their deals. They send each email from their own mail app, call
through their phone and log the outcome, then tick each step off. A manager sees connect rate, replies and meetings
per flow. An admin gives an outside tool a read-only key. Claude or ChatGPT can ask about a deal through MCP, seeing
only what that person can see. An agent writes a deal brief when a deal moves stage.
