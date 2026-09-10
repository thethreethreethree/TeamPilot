# FOUNDATION — working app code, not pseudocode

The parts of an **Expo / React Native** build that are the same on every
project: the on-device database and its migrations, integer-cent money, secure
storage and a biometric gate, permission handling that survives a "no", the
theme bridge, the navigation shell, and honest error / not-found surfaces.

This is the **App Edition**. It replaces the web foundation wholesale — there is
no server, no HTML, no server actions here. The *patterns* the web foundation
proved carry over (fail-closed, integer money, replayable migrations, honest
empty states, no secrets in the repo); the mechanics are all native now.

**What is NOT here:** anything domain-specific. No real schema, no screens, no
components beyond pure plumbing. That is the part you bring.

---

## Why `.template` extensions

The kit folder sits inside a project whose typechecker and linter scan the whole
tree. Real `.ts`/`.tsx` files here would produce blocking violations in the
*host* project's gate. The extension keeps them inert; `install.sh` strips it on
the way in.

---

## Install

```sh
./install.sh /path/to/expo/project
```

Copies each file to its correct location, renames it, and reports anything it
skipped because a file already existed. **It never overwrites.**

Then search the codebase for `TODO(project)` — every one is a decision you must
make. Nothing here works correctly until they are all resolved.

---

## What is in here

### `lib/` — the parts that are hardest to get right twice

| File | Why it exists |
|---|---|
| `db.ts` | expo-sqlite handle cached across Fast Refresh; migrations run **on launch**, replayably. A schema change needs a relaunch to apply. |
| `schema.ts` | Example on-device schema (integer-cent money, soft-delete) plus the guarded `ADDED_COLUMNS` list — `alter table add column` throws on a second run, and on a device every launch is a second run. |
| `money.ts` | Integer-minor-unit money. A float in the money path is a bug a customer finds; offline arithmetic makes drift accumulate unseen. |
| `format.ts` | Money → string and UTC-safe dates, at the display edge only. |
| `secure.ts` | expo-secure-store wrappers (secrets NEVER in SQLite, which is plaintext) + a **fail-closed** biometric gate (expo-local-authentication). |
| `theme.ts` | A small bridge over the generated `theme.ts`, adding `useColors()` for the imperative colours a NativeWind class cannot carry. |
| `permissions.ts` | Request-in-context, classify the answer into grant / retry / **blocked**, and route a blocked user to Settings instead of a dead end. |

### `app/` — the navigation shell and the failure surfaces

- `_layout.tsx` — expo-router root: fonts, safe-area + theme providers, reduce-motion-aware stack, and the app-wide `ErrorBoundary`.
- `(tabs)/_layout.tsx` — a bottom tab bar (3–5 destinations) with accessible labels.
- `+not-found.tsx` — the catch-all for a dead deep link / notification, with a route home.

### `components/`

- `StatefulForm.tsx` — one wrapper giving every form its loading / error / **neutral success** states, visible labels + `accessibilityLabel`, and `KeyboardAvoidingView` so the keyboard never hides the button. Plus a labelled `Field`.
- `ErrorBoundary.tsx` — the human failure screen the root layout mounts.

### `app.config.ts`

The native manifest: name, slug, bundle id / package, icon / splash / adaptive
icon, permission usage strings (iOS `infoPlist` + Android `permissions`), and the
config-plugin list. Replaces the web foundation's metadata / sitemap / robots
entirely — an app has a listing and an OS, not URLs and crawlers.

### `scripts/`

`README.md` only. **There is no deploy or backup script**, because a native app
has no server to push to and no central database to snapshot. It points at
`../../05-DEPLOYMENT-METHOD.md` (EAS release lifecycle) and explains where the
user's data actually survives (OS backup + a user export you build).

---

## Order of use on a new project

This mirrors `../01-BUILD-SEQUENCE.md` — see it for the gate on each phase.

0. **Scaffold Expo (RN + TS) and wire NativeWind FIRST.** The foundation's layout
   builds on the NativeWind config and the entry file the scaffold provides;
   NativeWind's babel/metro setup must already be in place or no `className`
   resolves. *(verify current)* against the installed NativeWind version.
1. Run `install.sh`. It never overwrites; read the `NOT INSTALLED` list,
   especially the `app/_layout.tsx` warning — a scaffold always ships its own,
   so the foundation's (fonts, providers, reduce-motion, ErrorBoundary) is the
   one you must merge in by hand.
2. Resolve every `TODO(project)`, and install **all** the dependencies the
   installer names — with `npx expo install`, which pins each to your SDK. A
   version-skewed native module is the classic "works in dev, crashes in the
   release build".
3. Generate tokens (`token-gen --theme` → the generated `theme.ts` + NativeWind
   config), then point `lib/theme.ts` at where it landed. Verify contrast in
   **both** light and dark on what actually landed on disk.
4. Write your on-device schema into `schema.ts`, following the shape there.
5. Build the core flow before any secondary screen.

---

## What these files assume

- **Expo (managed)** with **expo-router** file-based routing, EAS for builds.
- **expo-sqlite** for on-device storage (the modern synchronous API — `db.ts`
  flags the legacy-API trap).
- **NativeWind** for styling, fed by a generated `theme.ts` (hex colours, dp
  sizes) — every colour/size in a component is a token class, never a raw hex.
- **iOS and Android both**, phone and tablet.

Where your stack or SDK version differs, the *structure* still holds — the
fail-closed gate, the replayable migration, the request-in-context permission,
the transaction boundary noted in `schema.ts`. Port those. Do not port the exact
API name and assume you got the substance: several names here are marked
`(verify current)` precisely because Expo, NativeWind, and expo-router move their
surfaces between releases.

---

## A note on verification

Nothing here has been run — there is no Expo project in this kit to run it
against. It is written to be **correct by reading**: idiomatic, typed, and
commented with the *why*. Every version-specific API is flagged `(verify
current)`. On your project, none of it is verified until you exercise it on a
**real device** (build sequence Phase 9). A screen that renders in a simulator is
not proof the record was written or the permission-denied path works.
