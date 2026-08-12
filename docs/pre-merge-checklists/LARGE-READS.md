# Pre-merge checklist — large / growable reads (truncation-safe)

**Source assets:** [[reference_unbounded_select_silent_truncation_1000cap]] · the honesty thesis (§3.4 — a silently
truncated read is a lie of omission) · [[A16]] (compose, don't fork — reuse the shared helpers below).
**Triggered by:** the 2026-08-12 truncation-class sweep — dashboard / CARE analytics / sales-session list / KPI
compute-cron / admin coach-readout / brain learning-summary / finance register all silently truncated at
PostgREST's 1000-row cap and were fixed the same session. This file is the "what to do instead."
**Purpose:** INVARIANT 21 mechanically flags a `.limit(N>1000)` false bound — but it only says *you did it wrong*.
This file says *do this instead*, and is linked from INV21's finding so it surfaces at the moment of the flag.

---

## The hard fact

`supabase/config.toml` sets `max_rows = 1000`. **PostgREST caps EVERY row-returning read at 1000, regardless of a
larger client `.limit()`.** So:

- An **unbounded `.select()`** on a growable table returns ≤1000 rows — silently.
- A **`.limit(2000)` / `.limit(5000)`** returns ≤1000 rows — it *looks* bounded in review but is a lie.

When those rows are then **aggregated in JS** (a `count`, a `Set`, a `reduce`, a rate, a median), the aggregate is
**silently wrong** past 1000 matching rows — and it looks plausible, so nobody notices. It worsens exactly as a
customer succeeds and accumulates data. That is the honesty-thesis failure class (§3.4): a wrong number is worse
than a visible error.

---

## The decision tree — pick by what you DO with the rows

### 1. You AGGREGATE the rows (count / sum / rate / median / build a Set/Map) → page the full set

Use **`fetchAllPaged`** (`@/lib/supabase/paginate`). It reads every page past the 1000 cap and **fails honestly
(throws)** rather than returning a truncated set as if complete.

```ts
const rows = await fetchAllPaged<Row>(
  (from, to) => sb.from("events").select("kind, payload").eq("company_id", cid).order("id").range(from, to),
  { label: "learning-summary coach events" },
);
```

- **Order by a UNIQUE, STABLE key** — the uuid `id` PK. Range paging over a non-unique order (e.g. `created_at`
  alone) can skip or duplicate rows across page boundaries.
- **Latest-per-group semantics?** (e.g. "the newest event per session wins") — order by the semantic key DESC
  **then `id` DESC** as the stable tiebreaker, and keep the first-seen. Ordering by `id` alone would break it.
- **Inside a `Promise.all`, or feeding a §3.4 `error`-combine** (`const e = eA ?? eB ?? …`)? — use
  **`fetchAllPagedResult`** instead; it maps the throw back to `{ data, error }` so your existing honest-error
  handling is unchanged.

### 2. You only need the COUNT → head count (not row-capped)

```ts
const { count } = await sb.from("t").select("id", { count: "exact", head: true }).eq("company_id", cid);
```

A `head: true` count is **not** subject to `max_rows`. Never bulk-load rows just to `.length` them.

### 3. You DISPLAY the rows to a user → cap at max_rows + DISCLOSE the truncation

A register / thread / list is read, not aggregated. Cap **explicitly at 1000** (the honest single-page max — the
same value `assetReadout.FILE_SCAN_CAP` uses), and **tell the user** when there's more, rather than hiding it:

```ts
.order("txn_date", { ascending: false }).limit(1000)
// then, only when the page is full, head-count the total and return { total, truncated }
// UI: "Showing the most recent 1,000 of N — older lines aren't listed here yet."
```

Full retrieval of the older rows is a **load-older / paginated UI** — a UX decision, a separate build. Disclosure
is the honest stopgap (the finance bank register, build xx; `assetReadout.bounded`; team-analytics `capped`).

### 4. You want an INTENTIONAL cap → make it ≤ 1000

A deliberate "top 300" is fine as `.limit(300)`. A `.limit(N>1000)` is never a real bound — it is a lie that
returns ≤1000. **INVARIANT 21 flags every `.limit(N>1000)`.** If a site is a genuinely-tracked exception,
allowlist it in `FALSE_LIMIT_ALLOWLIST` *with a reason* — but note the allowlist is **self-cleaning** (build xu):
once you remove the limit, the audit REQUIRES you remove the entry too, or it flags the stale entry + fails its
own self-test.

---

## The gap INV21 does NOT catch (know it)

INV21 flags an explicit `.limit(N>1000)`. It does **not** flag an **unbounded `.select()`** (no limit at all) on a
growable table whose rows are then aggregated — that is the *most common* materialized shape, but "is this
aggregated vs paginated-for-display" is semantic (not regex-detectable) and a growable-table full-select is often
legitimately fine, so it is **not** mechanically guarded (declined, `project_audit_provenance_2026_08_02`). **This
checklist is the defense for that case.** When you add a `.select()` on `events`, `coaching_transcript_segments`,
`coaching_cues`, `support_messages`, `signals`, `chat_messages`, `decisions` (the fast-growers) — run the decision
tree above.

---

## Before claiming "shipped"

- [ ] Every read that AGGREGATES pages the full set (`fetchAllPaged` / `fetchAllPagedResult`) or uses a head count.
- [ ] Every DISPLAY read caps at ≤1000 AND discloses when truncated.
- [ ] No `.limit(N>1000)` survives (INV21 will fail the gate; if intentional-and-tracked, allowlist WITH a reason).
- [ ] Paged reads order by a unique stable key (`id`); latest-per-group keeps the semantic-DESC + `id`-DESC order.
- [ ] The paged-read path has a test, or is covered by `paginate.test.ts` + a route test of the derived value.

---

## Why this lives here (and is wired to INV21)

Per [[A30]] and the `LEADER-VISIBLE-DATA.md` lesson: a checklist that must be *remembered* is not a defense.
This one isn't asked to be remembered — **INVARIANT 21's finding message links here**, so an engineer who trips the
guard is handed the correct pattern at the moment of the violation. The mechanical check catches the mistake; this
file answers "then what?" — the half a `Violations: 1` line can't carry.
