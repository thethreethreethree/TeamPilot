# 05 — DEPLOYMENT METHOD

Read before you build anything you intend to ship.

**There is no server to deploy to.** A native app is not hosted; it is *released* — pushed through
a platform lifecycle that ends on someone else's phone and inside someone else's review queue. So
this document is not a push sequence, it is a release lifecycle: **dev builds → off-store testing →
store submission**, three distinct stages, the last one weeks-slower and reviewed by a stranger.

**This document carries the release's standing credentials — Apple Developer, App Store Connect,
Play Console and the signing material (§0) — so the agent builds and submits without stopping to ask
the owner.** That is a deliberate, owner-authorised choice with one hard cost: **this folder must
NEVER be committed to a repository, and signing keys must NEVER be committed anywhere** — a key in
the file is a key in every copy. What this document deliberately does NOT carry is a **version /
release-state inventory**: live state is re-derived from the stores and from EAS every time (§1),
because a version table in a file goes stale the moment anyone uploads a build — and a stale one
collided with a rejected build once already.

The governing facts, both of which shape every step below:

- **You cannot un-ship a store release.** There is no "stop the unit and reload the proxy." Once a
  build is live to the public it is on real phones; the only reversal is *forward* — a phased
  rollout you can halt (§11) and a fast-follow build.
- **The Android upload keystore is effectively irreplaceable.** Lose it and, in the worst case, you
  can never update the app again under the same listing. Signing is not a formality; it is the one
  artefact whose loss is unrecoverable. Back it up off-machine (§0).

---

## 0. Standing credentials & signing — you already have this; never stop to ask the owner

Two platforms, two accounts, two signing stories. Manage the signing material through **EAS
credentials** rather than by hand; let EAS hold the certificates and keystore, and keep a backup you
control.

```
Apple      Apple Developer Program account (paid, annual) + App Store Connect
           - Distribution certificate + provisioning profile  -> managed by EAS
           - App Store Connect API key for `eas submit`        -> stored in EAS, never in repo
Google     Google Play Console account (one-time fee) + a Play service-account JSON for `eas submit`
           - Upload keystore (you sign with this)              -> managed by EAS, BACKED UP off-machine
           - App-signing key (Google holds this after enrolment in Play App Signing)
EAS        `eas credentials`   inspect / rotate / download the signing material
Runtime    Match the toolchain EAS builds with — verify, do not assume (Expo SDK / EAS CLI version).
```

- **Never commit a keystore, a `.p8`/`.p12`, a provisioning profile, or a service-account JSON.**
  Add them to `.gitignore` *before* they exist, not after. A key that was ever committed is
  compromised even if you later remove it — the history keeps it.
- **Back up the Android upload keystore off the machine, the day it is created.** `eas credentials`
  can download it; store it somewhere the owner controls that is not the build machine and not a
  public/synced location. This is the §10 "off-machine backup" discipline applied to the one file
  you can never regenerate. Say this to the owner explicitly.
- **Prefer Play App Signing** (Google holds the app-signing key; you hold only the *upload* key). It
  means a lost upload key can be reset by Google — the difference between "annoying" and
  "unrecoverable." Confirm which model the listing uses before you rely on either.
- If `eas credentials` or `eas submit` fails with an auth error, the account access is missing from
  THIS environment — that is the one thing to raise with the owner. Everything else you derive
  yourself (§1); you do not stop to ask.

---

## 1. Survey the release state before you build anything

**Never trust a document's list of what version is live.** Version tables go stale silently, and a
stale one means uploading a build number the store already has — an instant, guaranteed rejection
that wastes a full build+upload cycle. This has already happened once: a note claimed the last
build was `41`; the store had `43` because someone submitted from another machine.

Re-derive live state every single time, from the authorities that actually hold it:

```
# what EAS thinks the current version / build numbers are
eas build:list                         # recent builds, per platform, with status
eas credentials                        # what signing material actually exists for each platform

# what the STORES actually show (the source of truth for "what number is taken")
App Store Connect  -> the app's iOS builds + current marketing version + latest build number
Play Console       -> the app's tracks (internal / closed / production) + current versionCode

# what THIS project declares locally (may lag the store)
app.json / app.config.*  -> version, ios.buildNumber, android.versionCode
eas.json                 -> build profiles + whether autoIncrement is on
```

Take the next build number **above everything the store shows**, not the first the document claims.
Write down what you found and *when* — the discrepancy is worth reporting, because the next agent
will read the same stale note.

**The survey goes stale in minutes, not months** on any team where more than one person can submit.
If EAS auto-increment is on (§4), let it read the store and pick the next number — that closes the
race a manual table can't. If you set a number by hand, survey again immediately before you upload,
not once at the start of the session.

**And the moment you write a version into a note, you have created the stale table this section
warns about.** Record next to the value where it was derived (which store, which track) and the
command to re-derive it, or the next person inherits your snapshot as fact.

---

## 2. On-device first. A backend only when it is unavoidable.

The locked architecture: the app's data lives **on the device** — encrypted at rest where the
platform allows — and the app works **offline by default.** This is the mobile equivalent of "bind
to loopback": the smallest attack surface and the fewest moving parts that can fail in the field.

- Reach for a backend **only when a feature is 100% impossible on-device** (multi-user sync, a
  server-authoritative computation, a shared source of truth). A convenience is not an
  impossibility.
- **Never put an external service in a safety-critical path.** If the app must do something the user
  depends on — especially anything with a safety dimension — it must do it with no network. A
  feature that silently requires a round-trip is a feature that fails in a tunnel, on a plane, in a
  dead zone, exactly when it is needed.
- If you do add a thin backend, everything in the WEB deployment doc applies to *that* server — and
  none of it is in this file. This file is the app's lifecycle, not the backend's.

Do not assume a library defaults to on-device or to encrypted storage. Force it explicitly, and
verify where the bytes actually land.

---

## 3. Dev builds — the fast inner loop

A dev build is not a release. It is the Expo **dev client** installed on your own hardware so you
can iterate with a live JS reload against real native code.

- **Build a dev client, not just Expo Go.** The moment the app uses a native module Expo Go does not
  bundle, Expo Go is lying to you about what will ship. `eas build --profile development` (the
  `development` profile in `eas.json`, `verify current`) produces an installable dev client.
- **Run on three surfaces, always:** iOS simulator **and** Android emulator **and** at least one
  **real device.** The simulator is convenient and it is not a phone — camera, GPS, secure
  enclave / keystore, push, background behaviour and performance all differ. A green simulator is
  not a pass (§9).
- **`npx expo prebuild` when native modules are involved.** The managed workflow generates the
  `ios/` and `android/` native projects from config; when you add a native module or a config
  plugin, prebuild regenerates them. Treat the generated native dirs as *build output*, not
  hand-edited source — a change you make there is erased by the next prebuild. Put native config in
  the config plugin / `app.config`, not in the generated project.
- Local `npx expo run:ios` / `npx expo run:android` compile on your machine and are useful for
  debugging native issues; EAS builds in the cloud with the credentials from §0 and is what the
  later stages consume.

---

## 4. Versioning — the number must move on every upload

Two numbers per platform, and confusing them is a rejection.

- **Marketing / user-visible version** — what the user sees ("2.3.0"). iOS
  `CFBundleShortVersionString`; Android `versionName`. In Expo this is `version` in
  `app.json`/`app.config`. Bump it for a release users should perceive as new.
- **Build number** — the internal counter the store dedupes on. iOS `CFBundleVersion`
  (`ios.buildNumber`); Android `versionCode`, which must be a **monotonically increasing integer**.
  **Every upload to a given track must carry a higher build number than the last**, even a tiny
  rebuild of the same marketing version. Reuse a number and the store refuses it.
- **Let EAS auto-increment.** Set the auto-increment option in the build profile (`eas.json`,
  `verify current`) so EAS reads the store's current number and picks the next — this is what closes
  the multi-machine race in §1. If you increment by hand, you own the survey.
- The two numbers are independent: you will ship many build numbers under one marketing version
  (every TestFlight / internal build), and occasionally reset the build counter's *meaning* when the
  marketing version bumps — but `versionCode` on Android must never go down regardless.

---

## 5. OTA updates (EAS Update) — powerful, and narrowly scoped

EAS Update pushes a new JS bundle and assets to already-installed apps without a store round-trip.
It is the closest thing to "redeploy," and it has a hard boundary.

- **It can change JS and assets. It cannot change native code.** New native module, changed
  permission, new config plugin, bumped native dependency, a prebuild-affecting change → a **new
  build** through the full lifecycle (§3→§6→§7). Pushing JS that expects native code the installed
  binary does not have is a crash, not an update.
- **Runtime version is the compatibility contract.** An update only applies to a build whose runtime
  version matches. Bump the runtime version whenever the native layer changes, or an old binary will
  pull a bundle it cannot run.
- **The stores forbid using OTA to change the app's purpose or bypass review.** Both Apple and
  Google allow JS bug-fixes and content updates over the air; both prohibit shipping a materially
  different app, or new user-facing capability, that was never reviewed. Treat OTA as "fix and tune
  what was approved," never "ship what review would have blocked." Crossing that line risks removal,
  not just rejection.
- Channels map builds to update streams (e.g. a `preview` channel for testers, `production` for the
  store build). Push to the tester channel first; a bad bundle on the production channel is on every
  live phone at once.

---

## 6. Off-store testing — real binaries, real devices, before the store

Test the **actual signed binary** on **other people's real devices** before you ever open the store
submission. This stage exists so the first stranger to run your build is a tester, not a reviewer.

- **iOS — TestFlight.** Upload the production-signed build to App Store Connect, distribute via
  TestFlight to internal (team) and external testers. External testers trigger a light Apple review
  of the TestFlight build — plan for it; it is not instant. TestFlight is the only sanctioned way to
  put an iOS build on a device that is not in your provisioning profile.
- **Android — several options, pick by audience:**
  - **Play internal testing track** — closest to production, up to a small tester list, near-instant
    availability, and it exercises the real Play install path and signing.
  - **Internal app sharing** — a quick shareable link for a one-off build, minimal ceremony.
  - **A direct APK** — sideload for a device in hand. Fast, but it does **not** exercise the Play
    signing / install path, so it is a smoke test, not a release rehearsal. An `.aab` (App Bundle),
    not an APK, is what Play actually ships.
- **Test off-store before store, on real devices, on both platforms.** A build that passes on your
  desk and is never handed to a second phone is untested (§9). The gap between "runs for me" and
  "installs and runs for a tester over a real store path" is where signing, permissions and
  first-launch state break.

---

## 7. Store submission — a distinct, later, reviewed stage

Submission is not the finish line of testing; it is a separate gate with a human on the other side.
`eas submit` (`--platform ios` / `--platform android`, `verify current`) uploads the build to App
Store Connect / Play Console using the §0 credentials. The build is the easy part. The listing is
the work, and **review guidelines are a gate, not a formality** — a technically perfect binary is
rejected for a missing usage string or an inaccurate privacy declaration.

Assemble, per platform, before you submit:

- **Listing metadata** — name, subtitle/short description, full description, keywords, support URL,
  marketing URL. Accurate to what the app does; a description that oversells a capability is a
  rejection.
- **Screenshots, per required device class.** iOS wants specific device sizes; Android wants phone
  and, if you target them, tablet. A missing required size blocks submission outright.
- **Privacy disclosure — and it must be true.** iOS **privacy "nutrition" labels** (App Store
  Connect) and Android **Data Safety form** (Play Console). Declare what data the app collects, why,
  and whether it leaves the device. An on-device-first app (§2) often collects *nothing that leaves
  the phone* — say exactly that; under-declaring is as much a rejection (and a legal) risk as
  over-collecting.
- **Permission usage strings** (§8) — present and honest, or the build is rejected on sight.
- **Category, content rating, age rating, and the review contact / demo account** if any flow is
  gated behind a login the reviewer must pass.

Submit to a **test track / TestFlight first even here** where the platform allows, then promote —
do not make the production track the first place a reviewer sees the build.

---

## 8. Permissions & privacy at ship time — every one, declared and requested

A permission the app uses but does not declare is a crash or a rejection; a permission it declares
but over-scopes is a privacy finding. Get both halves right for each one.

- **iOS: a usage-description string for every protected resource.** Each `NS*UsageDescription` key
  in `Info.plist` — e.g. `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`,
  `NSLocationWhenInUseUsageDescription`, `NSMicrophoneUsageDescription` — must be present and must
  say *why*. Missing string → the app is rejected, or crashes the instant it touches the resource.
  In Expo, set these via the config plugin / `ios.infoPlist` in `app.config`, not by editing the
  generated `Info.plist` (§3 — prebuild erases it).
- **Android: declare in the manifest AND request at runtime.** The `<uses-permission>` entry in
  `AndroidManifest.xml` (via `android.permissions` / the module's plugin) is necessary but not
  sufficient — dangerous permissions also need a **runtime request** the user can deny. Handle the
  denial path; a permission is a question, not a guarantee.
- **Request at point of use, with context, not at launch.** A permission prompt on the first screen,
  before the user knows why, is denied and then the feature is dead. Ask when the feature is
  invoked.
- **iOS App Tracking Transparency where relevant.** If the app tracks the user across other
  companies' apps/sites (ad attribution, third-party analytics that build a cross-app profile), iOS
  requires the ATT prompt (`NSUserTrackingUsageDescription` + the runtime request, e.g. via
  `expo-tracking-transparency`, `verify current`) *before* accessing the ad identifier, and the
  privacy labels must reflect it. An on-device-first app that tracks nothing (§2) declares exactly
  that — but "we don't track" must be *true*, including any SDK you pulled in.
- **Declare data collection accurately (§7) or face rejection and legal risk.** The privacy labels /
  Data Safety form are legal representations, not marketing. Audit what every dependency actually
  sends before you sign the form.

---

## 9. Verification — observe on a REAL device, both platforms

A green build proves the compiler was happy. It proves nothing about the phone. Install the built
binary and *watch it run* — on iOS and on Android, on real hardware, not only a simulator.

- [ ] The signed binary **installs** from the real path (TestFlight / Play track, §6), not just
      `run:ios`/`run:android` from your machine
- [ ] The app **cold-starts** to a usable first screen — no white-screen hang, no missing-bundle
      crash
- [ ] **The core flow actually completes** on the device. Do the main thing the app is for, to the
      end. A screen that renders is not a flow that works.
- [ ] **Offline works.** Toggle airplane mode and run the core flow — an on-device-first app (§2)
      must not degrade. If anything needs the network, that is a finding, not a feature.
- [ ] **Every permission tested BOTH ways** — **deny** each one and confirm the app copes, then
      **grant** and confirm the feature works. The deny path is the one that ships broken.
- [ ] **Background and resume.** Send the app to the background, wait, resume — state intact, no
      crash. Then kill and cold-start again — persisted data (§10) still there.
- [ ] Runs on **both** an iOS device and an Android device — behaviour, permissions and layout
      diverge between them by default
- [ ] The store build (not a debug build) is the one you exercised — release builds strip and
      optimise differently and fail differently

**A green simulator is not a pass.** Camera, location, secure storage, push, background execution and
performance are exactly the things a simulator fakes. If you did not run it on a phone, the word is
**untested** — say it plainly.

---

## 10. On-device data safety — the user's data lives on their phone

There is no database on a server you back up nightly. The user's data is on the device, and the
threats are different: an app update that migrates storage badly, an uninstall, a lost phone. Losing
it is losing everything the user put in — plan for it in the same session you ship.

- **Never lose data across an app update.** A schema/storage migration runs on the user's device,
  once, unattended, with no way to intervene if it goes wrong. Write migrations that are forward-only
  and idempotent, keep the old data until the new form is verified, and **test the upgrade path from
  the last shipped version**, not just a fresh install. A fresh install hides every migration bug.
- **Opt into the OS backup where it fits.** iOS backs eligible app data to iCloud; Android to Google
  backup. Understand what is and isn't included (secure-store / keychain items often are not) and
  decide deliberately per data class — some data *should* sync to a new phone, some (secrets) should
  not leave the device.
- **Give the user a way to get their data out.** A user-driven **export** (a file they can save/share)
  is the backup you control and the user owns — and often the only recovery path for data the OS
  backup excludes. For anything the user would be devastated to lose, an export is not optional.
- **Verify a restore, don't assume one.** A backup or export you have never restored from is a
  hypothesis. Install fresh, restore, and confirm the data is actually back and usable — the §9
  discipline applied to recovery.
- Say to the owner explicitly: on-device data that is not backed up or exported is one lost/wiped
  phone from gone. That is a product decision, and it should be a conscious one.

---

## 11. Rollback — you cannot un-ship, so roll forward carefully

There is no "stop the unit." A public store release is on real phones the moment it rolls out. The
whole rollback strategy is therefore *staged release plus fast-follow*, decided **before** you
submit.

- **Release in stages, so a bad build reaches few phones first.**
  - **Android — staged rollout.** Release to a small percentage of users and increase it. A crash
    spike shows up while most users are still on the old build.
  - **iOS — phased release.** App Store Connect rolls an automatic-update release out over several
    days; turn it on for any non-trivial release.
- **Halt the rollout the instant a real problem appears.** Both platforms let you pause an
  in-progress staged/phased rollout — that is your emergency brake. It stops *new* users getting the
  bad build; it does not recall it from the ones who already have it.
- **The only true fix is forward: a fast-follow build.** Prepare to build, submit and expedite a
  corrected version. Bump the build number (§4), and use an expedited-review request for a genuine
  breakage — reserve it for real emergencies, it is not routine.
- **OTA rollback only for a JS-only regression.** If the fault is in JS/assets and the last-good
  bundle is still compatible (same runtime version, §5), roll the update channel back to it — that
  reaches installed apps in minutes and is the one fast reversal you have. A native fault cannot be
  fixed this way; it needs the forward build above.
- **A pulled listing is not a rollback.** Removing the app from sale stops new installs and does
  nothing for the users who already updated. Don't mistake "unpublish" for "undo."

---

## 12. Build & submission traps

The build machine is in the cloud and the failures do not say what they mean.

- **`expo prebuild` erases hand edits to `ios/`/`android/`.** Anything you changed directly in the
  generated native projects is gone on the next prebuild, and the symptom is "my fix vanished."
  Native config belongs in the config plugin / `app.config`, never in the generated dirs (§3).
- **Match the native dependency to the SDK, not to your dev machine.** A native module that resolves
  fine locally can have no compatible build for the Expo SDK / native toolchain EAS uses, and it
  fails in the cloud build, not on your desk. Pin versions the current SDK supports (`verify
  current`), and read the build log — the real error is usually a native compile line, not the
  summary.
- **A build that fetches from the internet is a build that breaks on the build server's network.**
  Same lesson as the web doc: anything the build downloads at build time is a dependency on someone
  else's uptime. Vendor assets into the repo where you can, rather than reaching out mid-build.
- **A credentials mismatch reads like a code error.** A wrong/expired provisioning profile,
  distribution certificate, or a bundle identifier that doesn't match the profile fails the build or
  the submit with a message that looks unrelated. Check `eas credentials` (§0) before you suspect the
  code.
- **The bundle identifier / package name is permanent.** iOS bundle id and Android
  `applicationId` identify the app to the store forever; you cannot rename them on an existing
  listing. Get them right at first submit — a typo is a new app, not an edit.
- **Submitting the wrong artefact.** Android ships an **`.aab`**, not the APK you sideloaded for
  testing (§6). iOS submits the build already uploaded to App Store Connect. Sending the test
  artefact to the store is a wasted cycle.
- **Store metadata is a gate too (§7).** A green `eas submit` uploads the binary; it does not fill in
  the privacy labels, screenshots or usage strings. "The build went up" is not "the app is
  submittable."

---

## 12b. Traps in the machine you build *from*

The cloud build is not the only thing that can defeat you; the local setup around it can.

- **A stale native project defeats a config change.** Editing `app.config` and running an old
  prebuilt `ios/`/`android/` gives you a build that ignores your change. Regenerate (prebuild) or
  clean the native dirs when config that affects native isn't taking effect.
- **Simulator/emulator caches lie.** A "fixed" bug that persists, or a "broken" build that is
  actually stale, is often the JS bundler cache or an old install on the device. Clear the cache /
  reinstall before you trust either result — the §9 real-device pass is the arbiter, not the
  simulator's memory.
- **On Windows: iOS builds do not run locally.** iOS compilation needs macOS; the cloud EAS build is
  the path, and you cannot smoke-test the local `run:ios` route from Windows. Plan the iOS loop
  around EAS + a real iPhone, not around a local simulator you don't have.

Neither the box nor the store is the whole story; the machine you build from has its own quirks, and
each one looks like a broken command rather than what it is.

---

## 13. The lifecycle is slow where you can't see it — plan for the queue

The inner loop (§3) is fast; the outer loop is not, and the slow parts are outside your control.

- **Review has a wall-clock cost.** App Store review, external-TestFlight review, and Play review all
  take real time — hours to days, unpredictably. A release you need out on a date must be *submitted*
  well before the date, not built on it. A last-minute rejection has no fast recovery.
- **The build queue is shared.** EAS builds wait in a queue; a green light is not an instant binary.
  Don't schedule "build and submit" as if the build is free.
- **Two platforms, two timelines.** iOS and Android review, roll out and fail independently. A build
  live on one store and rejected on the other is the normal case, not an error — track them
  separately and don't hold the shipped one hostage to the stuck one.
- **The credential clock runs regardless.** The Apple Developer membership is annual; certificates
  and profiles expire. An expired credential blocks a build you needed *today*, silently, until you
  hit it. Know the renewal dates before they surprise a release.
