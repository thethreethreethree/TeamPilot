# 02 — DATA BLUEPRINT (on-device first)

Read before writing any schema, storage, or backend code.

The shape below suits a single-user mobile application: it runs on the device,
owns its data on the device, and reaches a server only when it genuinely has to.
That covers trackers, planners, logs, calculators, field tools, point-of-use
apps — the entity changes, the structure does not.

**On-device is the default. A backend is an exception you justify, not a
starting point.** A server enters ONLY when something is 100% essential and the
device cannot do it alone: multi-device sync, server-authoritative shared state,
or social / shared data between users. It NEVER sits in a safety-critical path —
if the feature must work when the network does not, it does not depend on a
server.

---

## 1. Persistence

**Default to on-device storage.** Nothing to bill, nothing to breach, works on a
plane. For a single-user app this is the right answer far more often than it
feels like it is.

- **Relational / queryable data → `expo-sqlite`.** One file in the app's
  sandbox, real SQL, the whole dataset lives with the user.
- **Small key-value state → MMKV or AsyncStorage.** Preferences, flags, the last
  screen. MMKV is synchronous and fast; AsyncStorage is the lowest-common
  default. Neither is for large relational data.
- **Secrets → `expo-secure-store` (iOS Keychain / Android Keystore). Never
  plaintext.** Tokens, keys, anything that authenticates or unlocks. AsyncStorage
  and MMKV are not secure storage — treat them as readable.

Reach for a backend only when you have a *stated* reason from the list above:
multi-device sync, server-authoritative shared state, or shared/social data. "It
feels more professional," "in case we scale," or "to keep the data safe" are not
reasons — on-device data is backed up and exported (§12), not orphaned. And a
backend never sits where the app must work offline.

**Native modules autolink; you do not hand-bundle a driver.** `expo-sqlite` and
friends are native modules resolved at build time by prebuild / EAS Build. The
web habit of marking a native driver "external" does not apply — but a *custom*
native module still requires a prebuild / development build, not Expo Go, or it
is simply absent at runtime and fails in a way that looks like a logic bug.

**Cache the database handle.** Open the SQLite connection once and reuse it;
re-opening per call or per render churns handles and stalls the UI thread. Hold
it in a module singleton or a context.

> Consequence worth knowing: if migrations run at handle-open time, and the
> handle is cached, **a migration only runs once per app launch.** A hot reload
> in dev does not re-open it. This will confuse you in dev exactly once.

---

## 2. Migrations must be replayable, not merely runnable

On-device databases migrate **on app launch**, and the next database your
migration meets is a stranger's: a user who skipped ten releases, restored an old
backup, or sideloaded a build from a year ago. It must be replayable **and it
must never lose the user's data** — there is no ops team to restore from, the
device is the only copy.

- Every `create table` / `create index` uses `if not exists`.
- Every seed is an upsert keyed on a stable natural key.
- Track a `user_version` (SQLite has one built in) and step forward from whatever
  version you find, not from the one you expected.
- `alter table add column` is **not** idempotent — it throws on the second run.
  Guard it by inspecting the table first:

```
ADDED_COLUMNS = [ { table, column, ddl }, ... ]

for each entry:
    read the table's existing columns
    if the column is already there: skip
    else: alter table add column
```

Keep that list as the *single* mechanism for post-release columns. Two parallel
migration mechanisms is how one of them silently stops being run.

**The test:** copy a populated database from an *old* app version onto a device,
launch the new build, confirm the data survives and the schema is current — then
launch again and diff. Identical output, no error, no lost rows, or it is not
done.

---

## 3. Money is always an integer

Store minor units — cents, and whole units for currencies without a minor unit.
Never a float. A rounding error in money is a bug a user finds and remembers.

If you display two currencies, **derive both from the same computation**, not
independently. Two totals that disagree by one unit destroy more trust than a
higher price would.

Do not compute a second currency from a live exchange rate at render time. Store
it as an explicit, owner-editable value. A rate that moves overnight silently
changes every price in the app.

---

## 4. Availability and capacity: one transaction, no exceptions

If your app holds a finite resource *on the device* — slots in a local planner,
units in an on-device inventory — the check and the write are **one
transaction**. Two fast taps on the last slot must not both succeed.

```
begin
  count capacity
  count what overlaps the requested window
  if none free -> return a refusal that names what to do next
  insert
commit
```

**Overlap is where the off-by-one lives.** Decide whether the end boundary is
inclusive or exclusive and write it in a comment at the schema, because you will
second-guess it later. Two ranges overlap when each starts before the other ends:

```
existing.start < requested.end  AND  existing.end > requested.start
```

**Verify by actually racing it.** Fill capacity to the last unit, fire two writes
back to back, and confirm one is refused with a useful message.

**A resource shared ACROSS users or devices cannot be arbitrated on a device.**
Two phones each hold their own SQLite; neither sees the other's write, so a local
transaction cannot prevent a global double-book. A shared finite resource is
therefore **server-authoritative** — it is exactly one of the "essential backend"
cases. The device proposes; the server decides and is the single source of truth
for the count.

---

## 5. Pricing with tiers is a covering problem, not a division problem

If you have day / week / month rates — or any quantity tiers — the naive
`floor(qty / tier)` plus remainder **overcharges**, and worse, it is
non-monotonic: a larger quantity can cost less than a smaller one.

Model it as: *the cheapest bundle of tiers that covers at least the quantity.*

```
best[0] = 0
for k in 1..qty:
    best[k] = min over tiers of ( tier.price + best[max(0, k - tier.span)] )
```

Clamping the index at zero is what lets a tier round *up* when that is cheaper —
which is the behaviour customers experience as fair.

**Assert the invariants across the whole range, not one example:**

- monotonic: cost(n) never decreases as n increases
- never worse than the base tier: cost(n) ≤ base_price × n
- if two currencies, both come from the same chosen bundle

---

## 6. Rate limiting and runaway guards

**On a single device there is no shared limiter to build.** There is one user and
one process; a "rate limit table" guarding your own user against themselves is
cost with no benefit. Abuse-limiting — the many-strangers-hammering-an-endpoint
problem — belongs on the backend **if one exists**, and only there. When it does,
the V2.2 rule stands: use a table, not memory (the process restarts on deploy and
an in-memory limiter forgets at exactly the wrong moment), count rows in a rolling
window, prune on write, and rate-limit **lookups** too — an unbounded reference-
code lookup is an enumeration oracle.

**What the device DOES need is a runaway guard**, which is a different problem:

- A retry/poll loop with no backoff drains the battery and heats the phone.
  Back off exponentially and cap it.
- Calling a device API (geolocation, sensors) in a tight loop degrades the whole
  system, not just your app.
- Spamming a **paid or metered external API** from the client is a bill and a
  ban. Debounce user-triggered calls, coalesce duplicates, and cache the last
  result rather than re-asking.

---

## 7. Authentication: fail closed

For an on-device app the "auth" is usually a **local gate**, not a login: prove
it is the phone's owner, then unlock what is stored.

- **Biometric gate for sensitive surfaces** — Face ID / Touch ID via
  `expo-local-authentication`, backed by Android BiometricPrompt — with a device
  passcode fallback.
- **Secrets live in Keychain / Keystore** (`expo-secure-store`), never in
  AsyncStorage, MMKV, or plaintext, and never checked into the repo.

Non-negotiable regardless of scale:

- **No credential / no gate satisfied → locked, not open.** The opposite default
  is how a "quick" unlock ships wide open.
- Any token you hold is stored in secure storage with an expiry, not left to live
  forever.
- **Constant-time comparison** wherever you compare a secret or a PIN. Hash both
  sides first so the compare is always over equal-length buffers.
- **Re-check authorisation inside every privileged action.** A screen rendered
  behind the gate is not proof the action fired behind it — the app can be
  backgrounded and resumed, deep-linked into, or restored mid-flow.
- Never reveal whether a secret is even configured. One message for all failures.

If a backend is in play, the same principles apply server-side, and the server —
not the client — is the authority on what the user may do.

---

## 8. Deletion: soft wherever a record points at it

Anything a completed record references gets deactivated, never removed. A hard
delete orphans history and the user needs that history readable.

Rows nothing references — a throwaway tag, a scratch unit — can be genuinely
deleted.

Decide this per table when you design it, and write the reason in the schema.

---

## 9. Data freshness

Cached data is a convenience, never a lie. If a value can change, **the UI must
not present a stale copy as the live truth.**

- **Stale-while-revalidate:** show the cached value instantly, refetch in the
  background, reconcile when it lands. The user sees something now and the truth
  soon — but never a stale number dressed up as current.
- **Invalidate on write.** A local edit updates the cache immediately; a UI that
  keeps showing the pre-edit value looks exactly like a caching mystery.
- **Offline writes go through a queue** with a durable, ordered outbox that
  replays on reconnect. Reconcile against the server's answer when it returns,
  and surface a conflict rather than silently dropping one side.
- Where freshness genuinely matters and the source is remote, mark data as
  "last updated ⟨time⟩" rather than implying it is live.

---

## 10. Owner-configurable content

The usual failure: an app whose content is frozen in the binary. Copy, prices, a
phone number, a list of items — all baked in, so every change is a new build.

Two levers, and you should be explicit about which each piece of content uses:

- **In-app settings / owner mode** — content the owner edits on the device,
  stored locally. The right default: no round-trip, works offline, ships instantly.
- **Remote config** — content the owner changes without shipping a build, fetched
  and cached (degrade to the last-known value offline). Use it for things that
  must change for *all* users at once.

**Content that can change ONLY by shipping a new store build is a standing
dependency — NAME it.** A store review can take days; "just push an update" is
not a same-day fix on mobile. Anything the owner might need to change on their own
timescale must sit behind settings or remote config, not the binary.

Coverage checklist lives in `07-HANDOVER-GATE.md`. Apply it before calling the
data layer done.

---

## 11. Device media and permissions

- **Ask for the narrowest permission, at the moment of use**, with a clear usage
  string (§ app-store readiness in `07`). Photo library vs. camera are different
  grants — request only what the action needs.
- **Handle denial as a first-class path.** The user can refuse, or have refused
  before; offer a route to Settings, never a dead end or a crash.
- **Pick or capture** via `expo-image-picker` (library or camera); **validate by
  content — sniff the magic bytes**, because a filename or extension is whatever
  was claimed, not what the file is.
- **Cap the size**, and say the actual limit in the error.
- **Media stays on the device** unless a backend is genuinely essential (§
  Persistence). Do not upload the user's photos to a server just to have a server.
- **Never trust a supplied filename as a path.** Store under an id you control.

---

## 12. Data export

Any list the user builds, they will eventually want out — into a spreadsheet,
another app, or their own records. On the device, export is the **OS share sheet
/ file export**, not an HTTP CSV route.

- Write the file to app storage, then hand it to the OS **share sheet**
  (`expo-sharing`) — the user chooses where it goes. That is the mobile export
  path; there is no server route to authorise.
- Quote every cell; double internal quotes.
- **Neutralise leading `=`, `+`, `-`, `@`** — otherwise a crafted value executes
  as a formula when the file is opened in a spreadsheet. Formula injection travels
  with the file, wherever the share sheet sends it.
- Emit a UTF-8 BOM or non-ASCII names mangle in Excel.
- Let the user pick the destination; do not silently ship their data anywhere.
