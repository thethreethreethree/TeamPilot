---
started_at: 2026-08-23T06:45:00+08:00
---

# THINK — Meeting Coach go-live: nav entry + module entitlement, flag-guarded until migrations land

Founder chose "Resume Team-Sync go-live" (2026-08-23). Prep-up + Meeting Coach are built + deploy-verified but
URL-only. This surfaces them in the nav — gated so nothing advertises before its DB is in place.

## Design (from the nav/module mapping — §0)

Three facts shaped this:
1. The global `Sidebar` is seen ONLY by null-lock (hub) accounts; locked accounts get the `SalesCoachShell` /
   `CareShell` overlays. So a hub-only nav entry misses sales_coach accounts.
2. `/dashboard/meeting-coach` is a top-level route → `moduleForPath` classified it as the elostate hub → the 0207
   single-module lock (middleware) SILENTLY REDIRECTS a sales_coach-locked account away from it.
3. There is no `meeting_coach` module value, and Meeting Coach is a sibling of Sales Coach (reuses the engine, its
   components live under sales-coach/, it's a `session_kind`).

So: **bundle Meeting Coach into the sales_coach entitlement** (`moduleForPath` → sales_coach for the meeting-coach
subtree) and surface the entry in BOTH the Sales Coach shell (sales_coach accounts) and the global sidebar (hub
accounts). A care-locked account still can't reach it (not a care feature); hub always can (null lock).

## The go-live flag (§1.5.3 — external config)

The nav must NOT advertise the feature before migrations 0237 + 0238 are applied. The gate is
`NEXT_PUBLIC_MEETING_COACH_ENABLED` — build-time-inlined, founder-set AFTER db:apply + a redeploy. Until then the
entry is filtered out of both navs; the page stays reachable only by URL (and is A34-safe pre-migration). This is
config the repo can't hold, so per §1.5.3 it is **documented as a blocking setup step** with a verification
procedure (`docs/MEETING-COACH-GO-LIVE.md`) AND surfaced to the founder — not buried. Rollback = unset + redeploy.

## Ripple (holistic)
`moduleForPath` is load-bearing LIVE auth (the module hard-lock). The change EXPANDS access for sales_coach
accounts to the meeting-coach subtree (they were redirected away before) — safe: the entry is flag-off, the page
is A34-safe pre-migration, and a care-locked account is unaffected (still denied). Nav additions are the existing
`vendorOnly`-style filter (Sidebar) + a conditional spread (SalesCoachShell). Pure-logic change is unit-tested.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T06:52:00+08:00",
    "why_it_governs": "Understand before solving — read the nav/module mapping (the hub-only Sidebar + the redirect gotcha) before placing anything.",
    "how_this_build_will_embody_it": "Placement + the entitlement change follow the actual routing/lock behavior, not a guess." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T06:52:00+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited CLAUDE §§ + axioms via Read this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T06:52:00+08:00",
    "why_it_governs": "Layer-2/3 — a built feature unreachable from the nav isn't operationally delivered; the nav must leave a flowing path in.",
    "how_this_build_will_embody_it": "Surfaces Meeting Coach in the nav sales_coach + hub accounts actually use." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-23T06:52:00+08:00",
    "why_it_governs": "Proactive audit — checked how EVERY nav surface + the lock treats the route, not just the sidebar.",
    "how_this_build_will_embody_it": "Found the hub-only-visibility + redirect gotchas via the mapping and handled both." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-196", "read_at": "2026-08-23T06:52:00+08:00",
    "why_it_governs": "External-config completeness — the env flag + migrations live OUTSIDE the repo; documented as blocking, not buried.",
    "how_this_build_will_embody_it": "docs/MEETING-COACH-GO-LIVE.md records the values + a verification procedure + rollback; the flag defaults OFF." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T06:52:00+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: mapped first, traced the live-auth ripple, gated on config, unit-tested the pure change." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T06:52:00+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T06:52:00+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T06:52:00+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "moduleAccess test locks the meeting-coach entitlement (sales_coach reaches it, care denied, hub allowed)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T06:52:00+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md carries the full `npm run check` exit-0 output + the exact test count." }
]
```
