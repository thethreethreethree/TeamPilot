---
started_at: 2026-09-03T12:28:00+08:00
---

# THINK — Gamification Phase 4 (manager notifications)

## Why
Continuing the gamification build (backend Phases 1-3 + the scoreboard done). Phase 4 adds the two in-app manager
alerts the plan specifies: a strong session and a closed deal. In-app only (founder was explicit; the codebase has
no generic notifications realtime channel to add).

## Understanding (recipient resolution)
There is NO per-agent manager FK (FINDINGS item 8): a "manager" is any company admin (role in CEO/COO/admin) OR
sales_coach_role='admin'. So an alert fans out to all of them (minus the agent themself). Idempotent via the
Phase-1 unique index (recipient_id, type, session_id) — a re-score / retry / re-record notifies at most once.

## The build
- `src/lib/coach/gamification/notify.ts` — resolveManagers + notifyStrongSession / notifyDealClosed. Upsert with
  ignore-on-conflict (idempotent). Resolves the agent's name once so the row renders without a join. Best-effort
  (caught) — never throws into the caller.
- Wires: strong_session fires from generateAndStoreAfterPitch (when bankSessionPoints returns strong);
  deal_closed fires from the outcome route when outcome='sold' (keyed on the LIVE value, not 0205's 'won' no-op).
- `/api/coach/gamification/notifications` — GET the caller's list + unread count (RLS recipient-scoped); POST
  mark-read (service-role, pinned to recipient_id = caller, since the table is SELECT-only to clients).
- `NotificationBell.tsx` — bell + unread badge + dropdown list + mark-all-read, polling (no realtime dep). Placed
  on the Scoreboard (manager-only), each alert linking to the session's after-pitch.

## Verification (layer-2, A38)
31 tests: notify fan-out (excludes the agent, idempotent upsert, empty-recipients, best-effort swallow), the wire
drift-guard (strong→alert fires, sub-threshold→none), and the leaderboard route. Typecheck clean.

## Out of scope
Low-score/streak/digest alerts (D5-D7), email/push/Slack, realtime. Calibration (Phase 6).

## Session-read manifest (A22 — read_at ≥ started_at 12:28; re-read this session)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-03T12:31:51+08:00",
    "why_it_governs": "Understanding precedes solving — recipient resolution follows the real role model, not an assumed manager FK.",
    "how_this_build_will_embody_it": "resolveManagers uses the company-admin/sales-coach-admin predicate from the record." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-03T12:31:52+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md in context; cited axioms re-opened this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-68", "read_at": "2026-09-03T12:31:53+08:00",
    "why_it_governs": "Retrospective identification — wired the alerts at the real trigger sites from the record.",
    "how_this_build_will_embody_it": "strong from the after-pitch generation, deal from the outcome route — the actual events." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "74-92", "read_at": "2026-09-03T12:31:54+08:00",
    "why_it_governs": "Holistic — the alert wires must not break the flows they hook.",
    "how_this_build_will_embody_it": "Both wires are best-effort (caught) so a notify failure never breaks the review or the outcome record." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-03T12:31:55+08:00",
    "why_it_governs": "Layer-2 effectivity — the alerts must actually fire + be idempotent, proven.",
    "how_this_build_will_embody_it": "Tests assert the fan-out, exclusion, idempotency, and the wire firing on strong." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-160", "read_at": "2026-09-03T12:31:56+08:00",
    "why_it_governs": "Reuse the repo's patterns.",
    "how_this_build_will_embody_it": "Service-role write + recipient-only RLS + upsert-ignore mirror the codebase conventions." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "162-198", "read_at": "2026-09-03T12:31:57+08:00",
    "why_it_governs": "User-specified experience is layer-2 (carried from the scoreboard commit in range).",
    "how_this_build_will_embody_it": "The bell UI is functional + legible; carried for range coverage." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "244-270", "read_at": "2026-09-03T12:31:58+08:00",
    "why_it_governs": "Ground-up audit (carried from Phase 0 in range).",
    "how_this_build_will_embody_it": "Rests on the Phase-0 role/notification findings." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-330", "read_at": "2026-09-03T12:31:59+08:00",
    "why_it_governs": "Single-source (carried in range).",
    "how_this_build_will_embody_it": "One notify module, two thin wires; no duplicated recipient logic." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-372", "read_at": "2026-09-03T12:32:00+08:00",
    "why_it_governs": "Honesty — no notification without a real event.",
    "how_this_build_will_embody_it": "Alerts fire only on a real strong session / real 'sold'; no fabricated notifications." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "384-405", "read_at": "2026-09-03T12:32:01+08:00",
    "why_it_governs": "Verify before claiming done.",
    "how_this_build_will_embody_it": "Ran the 31-test suite + typecheck before reporting Phase 4." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-03T12:32:02+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Reused patterns, kept best-effort, idempotent, tested, in-app-only per the founder." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-434", "read_at": "2026-09-03T12:32:03+08:00",
    "why_it_governs": "Leader-visibility privacy (carried in range).",
    "how_this_build_will_embody_it": "The alert surfaces a POSITIVE event to a manager, not a who-scored-low list — consistent with A18." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-03T12:32:04+08:00",
    "why_it_governs": "Methodology that governs the build must live in the working tree, not be cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this session before building Phase 4." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-595", "read_at": "2026-09-03T12:32:05+08:00",
    "why_it_governs": "Constitutional citations without session-reading are violations operating undetected.",
    "how_this_build_will_embody_it": "The manifest + commit trailer pair each cited section with an in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-09-03T12:32:06+08:00",
    "why_it_governs": "A lesson in prose recurs — encode the invariant in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The wire firing + the fan-out idempotency are test-pinned + DB-index-backed, not left to prose." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1004", "read_at": "2026-09-03T12:32:07+08:00",
    "why_it_governs": "'Verified' names the command + evidence.", "how_this_build_will_embody_it": "check.md pastes the test run + typecheck." }
]
```
