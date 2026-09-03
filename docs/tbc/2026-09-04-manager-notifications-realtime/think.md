---
started_at: 2026-09-04T03:15:00+08:00
---

# THINK — Realtime manager notifications (Supabase Realtime)

## Why (founder pick: push the alerts live)
The manager NotificationBell (gamification Phase 4) POLLS every 60s. The founder chose to make the strong-session /
deal-closed alerts arrive LIVE. Of the three paths surfaced, the founder picked Supabase Realtime (a WebSocket
channel) over a literal SSE endpoint (fragile on Vercel serverless — the function-duration cap) and over faster
polling.

## Understanding (from the code, §0)
- The app has NO DB-change realtime today (the only streaming routes are LLM token streams). This is the first
  `.channel()` in the codebase — greenfield, so the risk is getting the auth + RLS + config right.
- `manager_notifications` (0242) already has RLS: `recipient_id = auth.uid()` (SELECT). Supabase Realtime enforces
  the table's RLS PER SUBSCRIBER for postgres_changes, so a manager can only ever receive their OWN alerts — the
  same rule the REST reads already use. The browser client (`@supabase/ssr` createBrowserClient) authenticates the
  realtime socket with the user's session, so that RLS applies.
- External-config precondition (§1.5.3): Realtime only delivers a table's changes if the table is in the
  `supabase_realtime` PUBLICATION. That's config the repo CAN hold — as a migration — so it's verifiable, not a
  silent dashboard dependency.

## The build
- Migration 0245: idempotently add `public.manager_notifications` to the `supabase_realtime` publication (guarded:
  only if the publication exists and doesn't already carry it). INSERT-only subscription → default replica identity
  suffices (the new row is complete in the WAL for the recipient filter + the RLS check).
- NotificationBell: a second effect subscribes to this manager's own notification INSERTs
  (`filter: recipient_id=eq.<uid>`) and RE-FETCHES on each event (a re-fetch, not a payload prepend, keeps the shape
  + unread count consistent with the poll and avoids coupling to the realtime row shape). The 60s poll STAYS as the
  fallback for a dropped socket; a CHANNEL_ERROR/TIMED_OUT is logged, not fatal. Channel torn down on unmount.

## Verification posture (§1.5.3 / A38)
The publication + RLS are verified behaviorally against the live DB (probed pg_publication_tables + pg_policies).
The client WebSocket handshake itself can't be exercised in the sandbox (no browser/authed socket) — so the poll
fallback guarantees the feature degrades to "live within 60s" if Realtime is disabled/unreachable, and the live
push is confirmed on deploy. This is the honest unmet-in-sandbox precondition, surfaced not hidden.

## Out of scope
Email / web-push notifications (a separate deferred item). Realtime for any other table.

## Session-read manifest (A22 — read_at >= started_at 03:15 2026-09-04)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-04T03:35:00+08:00",
    "why_it_governs": "Understanding precedes solving — I traced the current poll, the RLS, and the absence of any realtime channel from the code before choosing the subscription shape.",
    "how_this_build_will_embody_it": "The subscription reuses the existing recipient-RLS as its security boundary rather than inventing a new one." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-09-04T03:35:10+08:00",
    "why_it_governs": "The methodology doc must be in the tree + read this session.",
    "how_this_build_will_embody_it": "THINK-BUILD-CHECK-PROMPTS.md present; CLAUDE.md sections re-consulted this build." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-04T03:35:20+08:00",
    "why_it_governs": "Layer-2 effectivity — 'the code is correct' is not 'it works' for a realtime feature whose delivery depends on config + a live socket.",
    "how_this_build_will_embody_it": "The publication is verified live; the poll fallback guarantees the feature still works if the socket fails; live push is confirmed on deploy." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-04T03:35:30+08:00",
    "why_it_governs": "Reuse the repo's clients + patterns, don't template new ones.",
    "how_this_build_will_embody_it": "Uses the existing browser client (createClient) + the existing notifications route + the existing RLS; adds only the subscription." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-198", "read_at": "2026-09-04T03:35:40+08:00",
    "why_it_governs": "The feature depends on config outside the code path (the realtime publication + Realtime being enabled) — the exact external-config-completeness class.",
    "how_this_build_will_embody_it": "The publication is added via an in-repo migration + verified live; the socket-enabled precondition fails SAFE (poll fallback) and is flagged for deploy confirmation." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-470", "read_at": "2026-09-04T03:35:50+08:00",
    "why_it_governs": "Quick-decision checklist (reuse, external-config, verify, fail safe).",
    "how_this_build_will_embody_it": "Reused client/route/RLS, verified the publication, kept the poll as the safe fallback." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-04T03:33:00+08:00",
    "why_it_governs": "Methodology in the tree, read this session — not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms this build before citing them." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-640", "read_at": "2026-09-04T03:33:40+08:00",
    "why_it_governs": "Cite only assets re-read this session; the manifest is the proof.",
    "how_this_build_will_embody_it": "Each entry carries an in-session read_at; the commit carries the Session-Reads trailer." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-04T03:33:20+08:00",
    "why_it_governs": "A lesson in prose returns; the fix must be a GATE — the realtime wiring must be test-pinned, not just described.",
    "how_this_build_will_embody_it": "4 render tests pin the subscription filter/event, the re-fetch-on-INSERT, teardown, and the unread render." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-04T03:34:00+08:00",
    "why_it_governs": "'Verified' names the command + evidence; mark what could NOT be run.",
    "how_this_build_will_embody_it": "check.md pastes db:apply (30/30), the live publication probe, and the tests; it names the client-socket handshake as verified-on-deploy, not claimed here." }
]
```
