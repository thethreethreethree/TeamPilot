# Sales Coach — Dashboard & Gamification: App Replication Spec

**Purpose.** A single, self-contained spec for the native app team to **replicate the "Today's Metrics" dashboard
screen and the gamification system** exactly as built in the web app. The app reuses the **same Supabase backend**,
so the data model + scoring already exist server-side — the app mostly **reads existing endpoints and renders the
UI**. This doc gives you the screen, the Arena, the points/data/API contracts, realtime, the design system, and the
privacy rules.

> Supersedes `GAMIFICATION-MOBILE-BUILD-SPEC.md` (which predates the two-page dashboard, milestone dates, and
> realtime). Source of truth in the web repo: migrations `0242`–`0245`, `src/lib/coach/gamification/*`,
> `src/components/sales-coach/{TodaysMetricsPager,RepArena,Scoreboard,NotificationBell,CalibrationTool}.tsx`, and
> `src/app/api/coach/gamification/*`. Mirror it — do not re-derive.

---

## 0. Architecture decisions (do not re-litigate)

1. **Reuse the after-pitch scores.** Every coaching session is already scored on dimensions
   (`after_pitch_summaries.payload.scores`). Points **derive from those** — no second AI judge, no separate scoring.
2. **Gamify within privacy (A18).** Team-wide **rank + totals + deals** are public; **per-session score detail is
   rep-private** (a rep sees their own; a manager their team's; peers never see each other's).
3. **Points-primary ranking:** total points, then average, then fewer sessions.
4. **Append-only ledger.** `SUM(points)` is the truth; corrections are new offsetting rows, never edits.
5. **No instant/fabricated results.** Never show a rank, band, or trust verdict with no data behind it — honest empty
   states everywhere.
6. **Gamification IS a leaderboard, by design** (founder decision) — the ONE openly competitive layer, exempt from
   the product's "coaching, never a leaderboard" rule that governs the coaching/KPI surfaces. Competition as
   motivation, within the privacy boundary above.

---

## 1. THE DASHBOARD SCREEN — "Today's Metrics" (two-page swipe)

This is the screen in the screenshots: the Macro/door-to-door **"Today's Metrics"** tab is **ONE module with TWO
swipeable pages**.

- **Page A — Progress (DEFAULT):** the gamified **rep Arena** (section 2). This is what the rep lands on when they tap the
  tab.
- **Page B — Metrics:** the original door **field metrics** (section 3).

### 1.1 Pager mechanics
- **Top segmented toggle** — `[ Progress | Metrics ]`, full-width, the active tab filled in **amber** (`#FACC15`),
  the inactive muted. This is the PRIMARY control (tappable, accessible). It's an ARIA `tablist`/`tab` (arrow keys
  Left/Right + Home/End move between tabs, roving tabindex, on a keyboard surface).
- **Horizontal swipe** — the enhancement, not the only way. Implement as a **finger-follow drag**: the two pages sit
  in a track (200% wide, two 50% panes); the track translates with the finger and **snaps** to the nearest page on
  release, with **edge rubber-band** (drag past an end resists at ~0.35×). Lock the gesture axis on the first move
  (~8px): a **horizontal-dominant** drag owns the pager and prevents the default; a **vertical** gesture is left
  entirely to the page's own scroll (never hijack vertical scroll). Snap commits a page change when the release
  distance exceeds ~22% of the width (or ~50px). Respect reduced-motion (no transition).
- **Default page = Progress (index 0)** on every open. Both pages stay mounted so a swipe reveals a ready page.
- Each page is its **own vertical scroll container**; the toggle stays fixed at the top.

### 1.2 Layout skeleton
```
┌───────────────────────────────────────────────┐
│  [ Progress • ]   [ Metrics ]        (toggle)  │  ← fixed
├───────────────────────────────────────────────┤
│  ◄─────────── swipeable track ───────────►     │
│  ┌── PAGE A: Arena ──┐  ┌── PAGE B: Metrics ─┐ │
│  │ gauge / odometer  │  │ Day/Week/Month/All │ │
│  │ stats / best      │  │ Next-Door focus    │ │
│  │ milestones / bars │  │ KPI trio + Score…  │ │
│  └───────────────────┘  └────────────────────┘ │
└───────────────────────────────────────────────┘
   (bottom app tab bar: Home · Pitch Performance · Today's Metrics · Role Play)
```

---

## 2. PAGE A — the rep Arena (Progress)

A personal record-keeping dashboard. Reads **`GET /my-points`** (the caller's own history) + the caller's own row
from **`GET /leaderboard`** (for best / deals / rank). Mobile-first, single column, on matte-black ink.

| Element | What it shows | Data |
|---|---|---|
| **Radial gauge** (270° arc, count-up) | center number = **average points** (0–100); center label = the current **band** (e.g. "NEEDS COACHING"); sub-line = `Best {best} · rank #{rank}` | `avg` from `/my-points`; `best_points`, `meRank` from `/leaderboard` |
| **Odometer** (grouped digits, e.g. `5 4 8`) | **total points earned** | `total` from `/my-points` |
| **Stat pair** (two cards) | **strong sessions** `{strong}/{sessions}` (sessions ≥ 80) + **deals closed** | `strong`, `sessions` from `/my-points`; `deals` from `/leaderboard` |
| **Best pitches** (records list) | top 3 sessions by points, each with its band label + date; a pitch **< 7 days old** is flagged **`NEW`**; tap → that session's after-pitch detail | from `/my-points` `rows` (sort by points desc, top 3) |
| **Milestones** (hexagon badges, on/off + **earned date**) | 5 badges; each earned one shows its **truthful earned-date** underneath (e.g. "Aug 12") | `milestones` map from `/my-points` (see section 5.3) |
| **Bars** | **last 7 sessions' points** (bar height = `points/100`; 0-pt sessions show a stub) | last 7 of `/my-points` `rows` |

**Milestones (the 5):** `spark` (first pitch scored), `flame` (a strong session ≥80), `deal` (first deal closed),
`century` (100 sessions), `closer` (10 deals). Each has an **earned-at date** derived server-side (section 5.3) — show the
date under the lit badge.

**Empty state:** a rep with no scored sessions sees "No pitches scored yet" — never a fabricated gauge/rank.
Per-session taps open the rep's **own** after-pitch detail (private to them). Respect reduced-motion (skip count-up /
bar-rise).

---

## 3. PAGE B — Today's Metrics (door field read)

The original door-to-door KPI screen (Macro Mode). Reads the door-log metrics (separate from gamification — the
**door-Macro KPI system**, `doorlog`, distinct from session-score gamification; don't conflate them).

- **Period selector** — `[ Day | Week | Month | All Time ]`, active tab amber-filled.
- **Next-Door Focus** — a highlighted card; a coaching prompt that appears "once you've logged a few analyzed
  pitches" (honest empty text until then).
- **KPI trio** (three cards): **Doors Knocked**, **Conversations**, **Sales** (the Sales card outlined in amber).
- **Score Chart** — horizontal progress rows for the door-pitch dimensions: **Objection**, **Talk / Listen**,
  **Questions**, **Tone**, **Close** (each 0-value until pitches are analyzed).

*(The app team already has / will build the door-log data source; this page is the existing Today's Metrics — the new
work is putting it behind the swipe alongside the Arena.)*

---

## 4. Points model

- Per-session total is **0–100** (`POINTS_SCALE_MAX = 100`).
- **Formula:** `points = round( mean(counted after-pitch dimension scores, each 0–10) × 10 )` (half-up). No scored
  dimension → **banks nothing** (never a fabricated 0).
- **Bands** (contiguous 0–100):

  | band | range | label |
  |---|---|---|
  | `elite` | 90–100 | Elite |
  | `strong` | 80–89 | Strong |
  | `solid` | 60–79 | Solid |
  | `developing` | 40–59 | Developing |
  | `needs_coaching` | 0–39 | Needs coaching |

- **Strong-session threshold = 80** (fires the manager alert).
- **Judged dimensions** (human-calibratable): `opener`, `objection`, `tone`, `close`, `next_step`. Computed
  (`talk_ratio`, `question_rate`) are excluded from calibration.
- Centralize these in **one** app module (`bandFor(points)` = band whose range contains `round(points)`). **Never**
  re-derive a boundary in a second place.

---

## 5. API contracts

Authenticate with the **Supabase access token as a Bearer** (`Authorization: Bearer <access_token>`) — every coach +
gamification route accepts it (the "mobile Bearer shim", all 26 coach routes). Routes under `/api/coach/gamification/`.

### 5.1 `GET /leaderboard?period=week|month|all`
Any authenticated member → the team board + the caller's rank.
```json
{ "period":"all",
  "rows":[ { "agent_id":"…","full_name":"Moses","sessions":57,
             "total_points":3604,"avg_points":63.2,"best_points":100,"deals":9 } ],
  "meId":"<caller>","meRank":2 }
```
`meRank` 1-based, or `null` if no points yet. Invalid period → `all`. Sort is points-primary.

### 5.2 `GET /my-points`  (the caller's own — owner-scoped)
Summary over the **full** history; `rows` = most-recent 200; `milestones` = earned-at map (section 5.3).
```json
{ "rows":[ { "session_id":"…","points":84,"band":"strong","created_at":"…" } ],
  "total":4210, "avg":74, "sessions":57, "strong":9,
  "milestones": { "spark":"2026-08-12T…","flame":"2026-08-21T…","deal":null,"century":null,"closer":null } }
```

### 5.3 Milestone earned-dates (in `/my-points.milestones`)
Each milestone's date is **derived from the immutable ledger** (durable + truthful by construction), computed
server-side where the full history lives:
- `spark` = the **first** scored pitch's date · `flame` = the **first** pitch ≥80 · `century` = the **100th** pitch
- `deal` = the **first** sold session's date · `closer` = the **10th** sold session's date
- `null` = not yet earned. Show the date under the lit badge; don't recompute client-side (you only get the recent
  window).

### 5.4 `GET /notifications` · `POST /notifications`  (managers; RLS-scoped to `recipient_id = caller`)
```json
// GET → { "notifications":[ { "id","agent_id","session_id","type","payload","created_at","read_at" } ], "unread":3 }
// POST { "all": true }  OR  { "ids":["…"] }   → { "ok": true }     // mark read
```
`type ∈ { strong_session, deal_closed }`; render from `payload` (no join needed).

### 5.5 `GET /calibration` · `POST /calibration`  (manager-only → 403)
```json
// GET → { "report": { "n","perDimension":[{"dimension","n","meanAbsDiff","trustworthy"}],
//                     "worstDisagreements":[…], "overallTrustworthy": true|false|null },
//         "scored":6, "pool":42,
//         "next": { "sessionId":"…","transcript":"REP: …\nPROSPECT: …" } }   // ANONYMIZED, model withheld
// POST { "sessionId":"…","scores":{ "opener":7,"objection":6,"tone":6,"close":5,"next_step":6 } }
//      → { "ok":true, "model":{ "opener":9,… }, "human":{ … } }              // reveal the model's scores
```
A dimension with **mean abs diff ≤ 1.5** is "trustworthy". `overallTrustworthy` is `null` until data.

### 5.6 Best-pitch drill-down (Bearer-ready)
- `GET /api/coach/sales-session/report-card/[pitchId]` — the pitch Performance report.
- `GET /api/coach/sales-session/[id]/after-pitch` — the between-doors debrief.
Both owner-scoped (rep sees own; manager their team's).

**Banking is server-side — the app never banks points.** On after-pitch generation the server banks one
`session_score` row (idempotent) and, if `points ≥ 80`, notifies managers (`strong_session`); on `outcome = 'sold'`
it notifies (`deal_closed`). The app only **reads**.

---

## 6. Realtime notifications (managers)

The manager notification bell receives new alerts **live** via **Supabase Realtime** (in addition to a poll fallback).
Replicate on the app with the Supabase client:

- The table `manager_notifications` is in the `supabase_realtime` publication (migration 0245).
- Subscribe (authenticated client, so the RLS applies **per subscriber** — a manager only ever receives their own):
  ```
  supabase.channel(`manager-notifs:${uid}`)
    .on('postgres_changes',
        { event:'INSERT', schema:'public', table:'manager_notifications', filter:`recipient_id=eq.${uid}` },
        () => refetchNotifications())      // re-fetch on a new alert (keeps the unread count authoritative)
    .subscribe()
  ```
- Keep a periodic poll (e.g. 60s) as the **fallback** for a dropped socket. Tear the channel down on unmount.

---

## 7. Weekly digest emails (server — informational)

The app does **not** build these (they're server crons), but managers + reps **receive** them, so surface them in
settings copy if relevant:
- **Manager digest** — every Monday, each manager gets their team's week (points / strong sessions / deals + top
  performers) with a Scoreboard link.
- **Rep digest** — each active rep gets their own week (points / band / best pitch) with an Arena link.
Both send via Postmark from the `weekly-digest-cron`; no app work required.

---

## 8. Design system (match the screenshots)

- **Brand = amber-gold "Lightbulb" on matte black** (mode-agnostic accent):
  - accent primary `#FACC15` (ember-400), pressed/hover `#EAB308` (ember-500); light-mode text-on-light `#A16207`.
  - ink surfaces: base `#09090B`, surface `#18181B`, raised `#27272A`; hairline borders ~`#2a2a34`.
  - text: primary near-white, secondary `~#A6ABB5`, muted `~#6B7079`.
  - **Positive/accent is amber — never green** for gamification (green is reserved for door "Sales"/deals accents in
    the Metrics page). Semantic warning also `#EAB308`.
- Arena specifics: gauge arc + "on" milestone badges + bars are **amber-gold** (`#FDE047`→`#EAB308` gradients);
  "off" badges are muted at ~0.4 opacity. Milestone badges are **hexagons**.
- Restraint: no XP bars / levels / streak flames / confetti. Big-number tiles only where the number is the point
  (points, gauge). Support light + dark.

---

## 9. Privacy rules (enforce on every screen)

- **Public layer:** rank, totals, avg, best, deals (the `/leaderboard` aggregate). Safe team-wide.
- **Rep-private:** per-session points/band/detail + the after-pitch breakdown — rep sees own; manager sees team's;
  **peers never see each other's**. Enforced by RLS on `agent_point_ledger`.
- **Calibration transcripts are anonymized** (speaker role only, `REP`/`PROSPECT`) — a manager calibrates the
  scorer, not a named rep.
- **Never** let the client write the ledger, notifications, or calibration directly (no client write policy — go
  through the server routes / service-role). Realtime is READ-only.

---

## 10. Build checklist (app)

- [ ] Auth: Supabase access token as `Authorization: Bearer` to the web API (or the Supabase client directly for
      RLS reads + realtime).
- [ ] **The two-page "Today's Metrics" screen** — toggle + finger-follow swipe, **Progress default**, both pages
      own-scroll (section 1).
- [ ] **Arena** page (Page A) — gauge / odometer / stat-pair / best-pitches (`NEW`) / milestones (**with earned
      dates**) / 7-session bars, from `/my-points` + own `/leaderboard` row (section 2, section 5).
- [ ] **Metrics** page (Page B) — the existing door Today's-Metrics (period tabs, Next-Door focus, KPI trio, Score
      Chart) (section 3).
- [ ] One module for the band constants + `bandFor()` (mirror section 4 — single source).
- [ ] **Scoreboard** screen (team) — `/leaderboard`, period selector, own-row highlight, aggregates only.
- [ ] **Notification bell** (managers) — `/notifications` GET + mark-read POST + **Supabase Realtime** subscription
      + poll fallback (section 6).
- [ ] **Score Calibration** (managers) — `/calibration` GET/POST, anonymized transcript, blind-then-reveal (section 5.5).
- [ ] Honest empty states everywhere; verify the privacy boundaries (aggregates public; per-session detail +
      calibration transcripts never leak a peer's identity).

---

*Mirrors the web build 1:1. If the web system changes (a dimension, a band boundary, a notification type, the pager
behavior), change it in the web repo's `src/lib/coach/gamification/*` + the components first, then update this spec.*
