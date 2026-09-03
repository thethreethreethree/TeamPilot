# Sales Coach — Gamification System: Mobile Build Spec

**Purpose.** A self-contained spec to rebuild the Sales Coach **gamification system** in the native mobile app.
The mobile app reuses the **same Supabase backend** as the web app, so the data model + scoring already exist server
side — the mobile build mostly **reads existing endpoints/tables and renders the UI**. This doc gives you the data
model, the scoring rules, the API contracts, the privacy rules, and the screen specs.

Source of truth in the web repo: migrations `0242`–`0244`, `src/lib/coach/gamification/*`, and
`src/app/api/coach/gamification/*`. Nothing here needs to be re-derived — mirror it.

---

## 0. Architecture decisions (do not re-litigate these)

1. **Reuse the existing after-pitch scores.** Every coaching session is already scored on dimensions (stored in
   `after_pitch_summaries.payload.scores`). Points are **derived from those** — there is **no second AI judge**, no
   separate scoring table.
2. **Gamify within privacy (A18).** Team-wide **rank + totals + deals** are public to the team; **per-session score
   detail is rep-private** (a rep sees their own; a manager sees their team's; peers never see each other's detail).
3. **Points-primary ranking.** The leaderboard sorts by total points, then average, then fewer sessions.
4. **Append-only ledger.** Points live in an append-only ledger; `SUM(points)` is the truth. Corrections are new
   offsetting rows, never edits.
5. **No instant results.** The system only reflects real, accumulated data — never fabricate a rank, a band, or a
   trust verdict with no data behind it.

---

## 1. Points model

- A per-session total is **0–100** (`POINTS_SCALE_MAX = 100`).
- **Formula:** `points = round( mean(counted after-pitch dimension scores, each 0–10) × 10 )`, rounded half-up.
  Only the scorer dimensions count. If a session has no scored dimension, it **banks nothing** (never a fabricated 0).
- **Bands** (contiguous over 0–100):

  | band | range | label |
  |---|---|---|
  | `elite` | 90–100 | Elite |
  | `strong` | 80–89 | Strong |
  | `solid` | 60–79 | Solid |
  | `developing` | 40–59 | Developing |
  | `needs_coaching` | 0–39 | Needs coaching |

- **Strong-session threshold = 80** (fires the manager "strong session" alert).
- **Judged dimensions** (the ones a human can calibrate): `opener`, `objection`, `tone`, `close`, `next_step`.
  The computed dimensions (`talk_ratio`, `question_rate`) are deterministic and **excluded from calibration**.

`bandFor(points)` = the band whose range contains `round(points)`.

---

## 2. Data model (already in Supabase — migrations 0242 & 0244; RPC 0243)

The mobile app does **not** need to create these — they exist in the shared project. It reads them (via the API
routes in section 3, or directly via RLS in section 4). Schemas, verbatim:

### `agent_point_ledger` (append-only points ledger)
```
id          uuid pk
company_id  uuid not null → companies(id)
agent_id    uuid not null → profiles(id)
session_id  uuid → coaching_sessions(id)   -- nullable (a manual correction may not attach to a session)
points      integer not null               -- may be NEGATIVE (a correction offsets a prior row)
reason      text not null  in ('session_score','correction','rescore')
detail      jsonb not null default '{}'     -- snapshot: { band, per-dimension points } (auditable history)
created_by  uuid → profiles(id)            -- null = the system
created_at  timestamptz not null default now()
```
- Unique: **one `session_score` row per session** (`where reason = 'session_score'`) — no double-bank.
- **Append-only trigger** raises on any UPDATE/DELETE. Corrections are new rows.
- **RLS (read):** the owning agent **OR** a company manager (`role in ('CEO','COO','admin')` **or**
  `sales_coach_role = 'admin'`), same company. **No client write** — the ledger is written by server/service-role only.

### `manager_notifications` (in-app alerts to managers)
```
id           uuid pk
company_id   uuid not null → companies(id)
recipient_id uuid not null → profiles(id)   -- the manager
agent_id     uuid not null → profiles(id)
session_id   uuid → coaching_sessions(id)
type         text not null in ('strong_session','deal_closed')
payload      jsonb not null default '{}'     -- enough to render without a join
created_at   timestamptz not null default now()
read_at      timestamptz
```
- Unique: `(recipient_id, type, session_id)` — the same event never notifies twice (idempotent).
- **RLS (read):** `recipient_id = auth.uid()` in the same company. **No client write** (mark-read is service-role).

### `gamification_calibration` (a manager's blind hand-scores)
```
id          uuid pk
company_id  uuid not null → companies(id)
session_id  uuid not null → coaching_sessions(id)
scorer_id   uuid not null → profiles(id)    -- the manager doing the blind scoring
scores      jsonb not null                  -- { opener, objection, tone, close, next_step } each 0–10
created_at  timestamptz not null default now()
```
- Unique: `(scorer_id, session_id)` — one blind score per manager per session (append-only; a re-score is a new row).
- **RLS (read):** company managers only. **No client write** (the calibration route writes service-role after a
  manager check).

### `gamification_leaderboard(p_period text default 'all')` — the board aggregate (RPC)
`SECURITY DEFINER`, company-scoped to the caller via `auth_company_id()`, returns **only aggregates** (no per-session
rows). `p_period ∈ {week, month, all}`. Returns one row per agent:
```
agent_id uuid, full_name text, sessions int, total_points bigint,
avg_points numeric, best_points int, deals int
```
- `sessions/avg/best` from `session_score` rows; `total_points` = `SUM(points)` (corrections included, so a corrected
  total stays honest). `deals` = count of that agent's `coaching_sessions` with `outcome = 'sold'` in the period.
- **Sort (points-primary):** `total_points desc, avg_points desc, sessions asc`.

---

## 3. Server API contracts (recommended for mobile)

The mobile app authenticates with its **Supabase access token as a Bearer** (`Authorization: Bearer <access_token>`)
— the web API routes accept it (the "mobile bearer shim"). All routes are under `/api/coach/gamification/`. This is
the **least-work path**: the server already computes ranking, paging, dedupe, and the manager gate.

### `GET /leaderboard?period=week|month|all`
Any authenticated member. Returns the team board + the caller's rank.
```json
{ "period": "all",
  "rows": [ { "agent_id": "...", "full_name": "Moses", "sessions": 57,
              "total_points": 3604, "avg_points": 63.2, "best_points": 100, "deals": 9 } ],
  "meId": "<caller>", "meRank": 2 }
```
`meRank` is 1-based, or `null` if the caller has no points yet. An invalid period falls back to `all`.

### `GET /my-points`
The **caller's own** history (owner-scoped). Summary is over the **full** history; `rows` are the most-recent 200.
```json
{ "rows": [ { "session_id": "...", "points": 84, "band": "strong", "created_at": "..." } ],
  "total": 4210, "avg": 74, "sessions": 57 }
```

### `GET /notifications`  ·  `POST /notifications`
Manager's own alerts (RLS-scoped to `recipient_id = caller`).
```json
// GET → { "notifications": [ { "id","agent_id","session_id","type","payload","created_at","read_at" } ], "unread": 3 }
// POST body: { "all": true }  OR  { "ids": ["<uuid>", ...] }   → { "ok": true }   // mark read
```

### `GET /calibration`  ·  `POST /calibration`   (manager-only → 403 otherwise)
```json
// GET → { "report": { "n", "perDimension":[{ "dimension","n","meanAbsDiff","trustworthy" }],
//                      "worstDisagreements":[{ "sessionId","dimension","human","model","diff" }],
//                      "overallTrustworthy": true|false|null },
//         "scored": 6, "pool": 42,
//         "next": { "sessionId": "...", "transcript": "REP: ...\nPROSPECT: ..." } }   // ANONYMIZED, model withheld
// POST body: { "sessionId": "<uuid>", "scores": { "opener":7,"objection":6,"tone":6,"close":5,"next_step":6 } }
//      → { "ok": true, "model": { "opener":9, ... }, "human": { ... } }              // reveal the model's scores
```
Calibration threshold: a dimension whose **mean abs diff ≤ 1.5** is "trustworthy". `overallTrustworthy` is `null`
until there is data (never a fabricated verdict).

**Banking is server-side — the mobile app never banks points.** When a session's after-pitch is generated, the
server banks one `session_score` row (idempotent), and if `points ≥ 80` notifies managers (`strong_session`); when a
session's `outcome` is set to `sold`, it notifies managers (`deal_closed`). The mobile app only **reads** the results.

---

## 4. Direct-Supabase alternative (if you skip the API layer)

If the mobile app talks to Supabase directly instead of the web API, RLS already enforces the privacy model:
- **Board:** call the RPC — `supabase.rpc('gamification_leaderboard', { p_period })`. (Returns aggregates only.)
- **My points:** `select session_id, points, detail, created_at from agent_point_ledger where agent_id = <me> and
  reason = 'session_score' order by created_at` — RLS lets a rep read their own rows. Compute total/avg/sessions over
  the **full** set (page past 1000 rows); `band` is in `detail.band`.
- **Notifications:** `select ... from manager_notifications order by created_at desc` — RLS scopes to the caller.
  You **cannot** mark-read directly (no client write policy); mark-read must go through the server route.
- **Calibration writes** must go through the server route (no client write policy on `gamification_calibration`).

Either way, **never re-implement the band boundaries or the points formula in a second place** — read `band` from the
stored data, or centralize the constants in one mobile module mirroring section 1.

---

## 5. Screens

### 5.1 Scoreboard (team, everyone)
A ranked board from `/leaderboard`: per-agent rank (1/2/3 emphasized), points (primary), a band chip, avg, best,
deals, and the caller's own row highlighted. Period selector (week/month/all). Honest empty state. Presentation is
restrained — no XP bars/levels/streak flames/confetti. **Exposes only aggregates** (never per-session detail).

### 5.2 My Progress — the rep Arena (rep's own)
A personal record-keeping dashboard (reads `/my-points` + the caller's `/leaderboard` row for best/deals/rank).
Mobile-first, single column. ELOSTATE branding: **ember/amber on ink** — accent `#FACC15` (light-mode `#A16207` for
contrast), surfaces ink `#09090B / #18181B / #27272A`, positive = ember `#FDE047` (no green). Elements:

| Element | Data |
|---|---|
| **Radial gauge** (270° arc, count-up) | **average points** (0–100); center label = current **band**; sub = `Best {best} · rank #{rank}` |
| **Odometer** (grouped digits) | **total points** earned |
| **Stat pair** | **strong sessions** `{count(points≥80)}/{sessions}` + **deals closed** |
| **Records board** | **best pitches** — top 3 sessions by points, each links to its own after-pitch; a pitch < 7 days old is flagged `NEW` |
| **Milestone badges** (hexagons, on/off) | derived from stats: first pitch (`sessions≥1`), strong (`≥1` at 80+), first deal (`deals≥1`), century (`sessions≥100`), closer (`deals≥10`) |
| **Bar chart** | **last 7 sessions' points** (bar height = `points/100`) |

Respect reduced-motion (skip the count-up / rise animations). Per-session taps open the rep's **own** after-pitch
detail — that stays private to the rep.

### 5.3 Notification bell (managers)
A bell reading `/notifications`: unread count, a list of `strong_session` / `deal_closed` items (render from
`payload`, no join needed), tap-to-open the session, and mark-read (single or all) via `POST /notifications`.

### 5.4 Score Calibration (managers) — the honesty gate
A manager hand-scores an **anonymized** transcript (`REP` / `PROSPECT`, **never** the rep's name) **blind** on the
five judged dimensions, submits, then sees **you vs the AI** per dimension + a running agreement report (mean abs
diff per dimension; a dimension over ±1.5 is flagged "needs a look"). This validates the score **before** it drives
ranks — it measures trust, it does not (yet) act on it. Reads/writes `/calibration`.

---

## 6. Privacy rules (enforce on every screen)

- **Public layer:** rank, totals, avg, best, deals (the leaderboard aggregate). Safe to show team-wide.
- **Rep-private:** per-session points/band/detail and the after-pitch breakdown — a rep sees their own; a **manager**
  sees their team's; **peers never see each other's**. Enforced by RLS on `agent_point_ledger`.
- **Calibration transcripts are anonymized** (speaker role only). A manager calibrates the **scorer**, not a named
  rep.
- **Never** surface another rep's per-session detail on a public surface, and never let a client write the ledger,
  notifications, or calibration directly.

---

## 7. Build checklist (mobile)

- [ ] Auth: send the Supabase access token as `Authorization: Bearer` to the web API (or use the Supabase client
      directly with RLS).
- [ ] One module for the band constants + `bandFor()` (mirror section 1 — single source, no re-derivation).
- [ ] Scoreboard screen (`/leaderboard`, period selector, own-row highlight, aggregates only).
- [ ] My Progress / Arena screen (`/my-points` + own `/leaderboard` row) — the six elements in section 5.2, ELOSTATE palette,
      both light + dark.
- [ ] Notification bell for managers (`/notifications` GET + mark-read POST).
- [ ] Score Calibration for managers (`/calibration` GET/POST, anonymized transcript, blind-then-reveal).
- [ ] Honest empty states everywhere (no fabricated ranks/bands/verdicts).
- [ ] Verify the two privacy boundaries: aggregates are public; per-session detail + calibration transcripts never
      leak a peer's identity.

---

*This mirrors the web build 1:1. If the web system changes (new dimension, new band boundary, a new notification
type), update it in the web repo's `src/lib/coach/gamification/*` first, then mirror the change here.*
