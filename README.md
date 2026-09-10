# Elostate Sales Coach

The mobile half of Elostate's Sales Coach, for representatives who knock doors for a living.

It mirrors the web app at `elostate.com/dashboard/sales-coach` — same Supabase backend, same routes, same scoring
rules — on the surface a phone is better at than a laptop: the ninety seconds between one door and the next.

---

## Shipping it

The app is feature-complete against both build specs. If you are trying to get it onto a phone or into the App
Store, these are the files, in the order you need them:

| File | What it is for |
|---|---|
| **`DEVICE-CHECK.md`** | 26 checks on a real device. If you have five minutes, do check 1. |
| **`APP-STORE-SUBMISSION.md`** | The App Review notes, App Privacy answers, what a reviewer will ask, and the pre-submission tidy-up. |
| **`APP-STORE-LISTING.md`** | Name, subtitle, description, keywords — written and ready to paste. |

`CONTINUE-HERE.md` is the architecture hand-off. `PHASE-3-SHIM-TO-APPLY.md` is superseded and kept for history.

---

## Running it

```bash
npm install
npx expo start
```

Recording needs a **development build**, not Expo Go — the audio module is native. `npx eas build --platform ios
--profile development` produces one, and the app says so plainly on the recorder screen rather than failing
silently when it is missing.

`.env.local` at this root holds the three settings the app needs. It is gitignored. The service-role key is
deliberately absent and must never be added — row-level security is what protects the data, and the anon key is
designed to ship inside a client.

---

## Checks

```bash
npm test            # 930 tests, node --test
npx tsc --noEmit    # types
npm run lint        # 293 files
node ../tools/gate.mjs   # the design gates, G1-G4
```

**Every guard in this codebase was proven by breaking it.** A test that has never been watched to fail is a claim,
not a check — so when something matters, the source was mutated, the named test was observed failing, and the
source restored. That habit found more real defects here than any linter did.

The one gate that cannot run from a laptop is **G5**, the runtime audit. It needs a phone. Nothing in this
repository can tell you the product works; it can only tell you the code is right, which is a different claim.

---

## How it is put together

- **Expo SDK 57 / React Native 0.86**, `expo-router` file-based routing under `src/app/`.
- **NativeWind** for styling. Every colour comes from a token in `src/lib/tokens/` — there is not one hand-typed
  colour class in the app, and the identity is deliberately a single amber ramp on matte black.
- **Logic lives in `src/lib/`, not in screens.** This is the load-bearing decision: `node --test` cannot load
  native modules, so anything that decides what to tell a representative is a pure module that can be tested, and
  the screen renders what it returns. When a bug is found, that split is usually why it was findable.
- **Two products in one app.** Macro Mode swaps the tab bar between the door-to-door surfaces and the standard
  coaching ones. `useMacroMode` decides; the tab bar and Home both read it.

## Two rules the code keeps

**An unknown number is never a zero.** A figure that could not be read renders as an em dash, and the screen says
why. A rep whose forty doors are safely on the server must never be shown "0 doors today" because a request timed
out.

**A failure says what to do about it.** "You have been signed out" and "the server turned this down" are different
sentences with different fixes, and the app tells them apart rather than showing one message for both. It used to
show one, and it told signed-out reps to wait for a deploy that would never come.
