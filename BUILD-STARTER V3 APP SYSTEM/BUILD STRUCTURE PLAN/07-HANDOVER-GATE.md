# 07 — HANDOVER GATE

Run this before telling the owner a build is deliverable. It is a checklist, not
a tracker — it does not get a status column, a manifest, or a script.

The standard: **everything works except the client's own data, and the client can
enter that data themselves.**

That last clause is the one that gets missed. An app that manages activity but
cannot change its content is not deliverable — every future edit routes through
you, and on mobile that means a new store build for a phone number.

---

## A. The core flow

- [ ] The primary flow completes end to end, **driven on a real device — iOS AND
      Android**, not only a simulator
- [ ] The resulting record is correct in on-device storage, field by field
- [ ] Capacity/availability is decremented, and the *last* unit cannot be
      double-taken (two fast taps)
- [ ] Refusals name what to do next, not just what went wrong
- [ ] The flow survives an app background/resume and a cold start mid-way — no lost
      state, no console errors
- [ ] Any confirmation the user relies on is retrievable later, offline

## B. Owner can manage content — the deliverability test

For every category of content in the app, ask: **can the owner change this
without me?**

- [ ] Business/app identity — name, contact, messaging, hours, service area
- [ ] The catalogue — add, edit, reorder, hide. Hiding is soft where records reference it
- [ ] Prices, in every currency shown
- [ ] **Images** — pick and replace, not just paths baked into a seed
- [ ] Inventory / capacity — add, retire, mark unavailable
- [ ] Records — view, change state, amend the consequential fields
- [ ] Owner-managed content routes through **in-app settings / owner mode or
      remote config**, not the binary
- [ ] **Nothing the owner may need to change is editable *only* by shipping a new
      store build** — every such dependency is named (a store review takes days)

Anything unchecked is a standing dependency on you. That is a decision the owner
should make knowingly, not discover later.

**Read the warning above as a SHAPE, not a checklist entry.** It says "manages
activity but not content". A real build read that literally, made every piece of
content editable, and shipped an app where the owner could not add a time slot,
close one when conditions changed, mark a record complete, or replace a
photograph. The mirror image of a named failure is completely unguarded unless you
go looking for it.

So run the test in both directions:

- for every **thing the app shows**, can the owner change it without you?
- for every **operation the business actually runs on** — its schedule, its
  records, its capacity, its people — can the owner do it without you?

**Include the brand artwork.** The logo, the app icon, the adaptive icon and the
share card are graphics like any other, and leaving them in code makes a client's
own identity a developer task — worse on mobile, where the icon changes only in a
new store build. Flag it as the standing dependency it is.

**And when capacity is generated rather than entered, ask what happens when it
runs out.** A build that generates a fixed window of slots at launch empties
silently once the window passes, offering nothing, with no error anywhere.

## C. Failure surfaces

- [ ] A route/screen-level error boundary — not a raw redbox or a white screen
- [ ] A root-level error boundary, for a failure in the navigator or layout itself
- [ ] **Offline states everywhere the app assumes connectivity** — a clear
      "you're offline" surface, not a spinner that never resolves
- [ ] Error copy states plainly whether anything was saved, charged, or lost
- [ ] Empty states everywhere a collection can be empty, written and actionable
- [ ] Permission-denied is a designed path, not a crash or a dead end

## D. App store readiness

- [ ] App name and subtitle set, and consistent across the stores
- [ ] Screenshots **per required device size**, for iOS AND Android
- [ ] **Privacy nutrition labels (App Store) and Data Safety form (Play)** filled,
      and honest about what is collected
- [ ] Permission **usage description strings** for every permission requested
      (`NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, etc.) — a
      missing string is a hard rejection
- [ ] Category chosen; age rating / content questionnaire completed
- [ ] **App icon and Android adaptive icon** (foreground + background), plus splash
- [ ] Support URL / contact and privacy-policy URL present (both stores require it)

## E. Data safety

- [ ] The user can **export / back up their on-device data** (§12 in `02`)
- [ ] **The backup/export has been produced** on a real device
- [ ] **Data has been restored from it back into the app** — a backup never
      restored from is a hypothesis
- [ ] Integrity checked, suspiciously small or empty output rejected
- [ ] Owner told, in writing, that on-device-only data is lost with the device
      unless it is exported or synced — name whether sync exists

## F. Mobile security

- [ ] **Code signing valid** — real distribution certificate / provisioning
      (iOS) and a signed release (Android); the build installs on a device that
      is not yours
- [ ] **No secret in the repository; credential and keystore files git-ignored
      *before* the first commit** — EAS credentials, service-account JSON, `.env`,
      `*.keystore`, `*.p8`/`*.p12`
- [ ] Secrets at runtime live in **Keychain / SecureStore**, never AsyncStorage,
      MMKV, or plaintext
- [ ] **No cleartext traffic** — iOS ATS not globally disabled; Android
      `networkSecurityConfig` forbids cleartext (verify current)
- [ ] **Least-privilege permissions** — every permission in the manifest /
      `Info.plist` is one the app actually uses
- [ ] Biometric / device gate on sensitive surfaces, failing **closed**
- [ ] Every privileged action re-checks authorisation (server-side too, if a
      backend exists)
- [ ] Exports neutralise formula injection

## G. Quality

- [ ] Every gate green, or every skipped gate named
- [ ] Types check
- [ ] **Real-device pass on iOS AND Android** — reviewed by eye, not only by audit
- [ ] Both **orientations** (or orientation deliberately locked and declared)
- [ ] **Dynamic Type / font scaling** — layout survives the largest system font
- [ ] Reduced-motion pass
- [ ] **Accessibility pass** — VoiceOver / TalkBack reach every control, targets
      are large enough, labels are present; external keyboard / switch control work
- [ ] No placeholder copy, invented statistics, or fabricated proof anywhere
- [ ] Every navigation path and deep link resolves

## H. The honest ledger

Write down, in the handover:

- [ ] Every value that is **assumed** rather than client-confirmed
- [ ] Every launch blocker still open
- [ ] Every gate that was skipped, and what that leaves unverified
- [ ] Every claim in the app the owner must be willing to honour
- [ ] Anything that can only change via a new store build (the standing dependency)
- [ ] Anything you built but did not personally exercise on a real device

---

## Percentage reporting

If asked for a completion figure, derive it from this checklist rather than
estimating from feel. State the two halves separately, name what the remaining
percentage actually consists of, and distinguish:

- **Excluded by decision** — the owner deferred it; not incompleteness
- **Genuinely missing** — nobody has decided; needs a decision
- **Missing and blocking** — must be closed before a client sees it

Never report a single blended number without saying what is inside it.
