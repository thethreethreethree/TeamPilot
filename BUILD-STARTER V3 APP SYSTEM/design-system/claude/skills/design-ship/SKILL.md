---
name: design-ship
description: Run every gate and produce the release report before a build is handed over. Use when the user says ship it, launch, submit, deploy, hand off, or asks whether the app is ready.
allowed-tools: Read Bash Glob Write
---

# Ship

A build is shippable when every gate is green **and** the judgement checks in
`/design-review` have been done. Not before.

## Gate sequence

```bash
# 1. Static — contract, lint, tokens, types
node tools/gate.mjs
npx tsc --noEmit          # types compile

# 2. It actually builds for the stores
eas build --profile preview --platform all      # or `expo prebuild` + native build
```

Then exercise the **running app** — this is where safe-area, tap targets, states
and screen-reader order are actually verified:

- On **iOS and Android**, on a **small phone, a large phone and a tablet**, and at
  the **largest system font size**.
- Every **screen** with a distinct layout. A clean home screen proves nothing
  about the checkout.
- Cold — via a **deep link** into a leaf screen — as well as from launch.

## Release checklist

Verify each. Do not tick from memory.

**Gates and build**
- [ ] `gate.mjs` reports PASS with no skipped gates
- [ ] `tsc --noEmit` clean; EAS/native build succeeds for iOS **and** Android
- [ ] Exercised clean on small phone, large phone and tablet, both platforms

**Accessibility**
- [ ] VoiceOver **and** TalkBack pass through every interactive flow
- [ ] Focused input never hidden behind the keyboard; hardware-keyboard focus
      visible where the app supports it
- [ ] Reduce Motion pass — nothing moves that should not
- [ ] Largest Dynamic Type / font scale: no clipping, nothing lost
- [ ] Touch targets ≥44pt/48dp; gesture-only actions have a visible alternative

**App shell and store assets**
- [ ] App icon (all required sizes) and Android adaptive icon set
- [ ] Splash screen configured; held only to first meaningful paint
- [ ] App name, bundle id / package name, version and build number correct
- [ ] Deep-link / universal-link / app-link config verified end to end
- [ ] Every permission has an in-context rationale and the platform usage strings
      (iOS `Info.plist` `NS…UsageDescription`, Android manifest)
- [ ] Locale(s) set; strings localisable; RTL checked if in scope
- [ ] Store listing assets (screenshots, description) ready

**Content**
- [ ] No lorem ipsum, no placeholder images, no invented statistics
- [ ] Every link and deep link resolves
- [ ] Empty, loading and error states written for every collection and async view
- [ ] Copy matches the `voice` declared in the contract

**Performance**
- [ ] Cold start acceptable on a **mid-range** device, not just the dev machine
- [ ] Every long list virtualized (`FlatList`/`SectionList`/FlashList)
- [ ] Images cached and sized to their target (`expo-image`)
- [ ] Animations on the UI thread; no dropped frames on scroll — check Perf Monitor
- [ ] Hermes enabled
- [ ] OTA update size reasonable; large static assets shipped in the binary

## Write the report

Create `.design/RELEASE-REPORT.md`:

- Gate results, verbatim, with timestamps
- Every waiver in the contract, with its justification
- Known limitations — what you did not verify and why
- Contrast table for the shipped tokens (both themes)
- Screens audited, and the devices, platforms and OS versions tested

## Honesty rule

If a gate is failing or was skipped, **say so in the first sentence** of your
handover. Never describe a build as done, verified, or accessible when the checks
that would establish that did not run — and never imply cross-platform coverage
from a single-platform run.

If the user asks you to ship anyway, that is their call — record it as a waiver
with their instruction, and hand over with the failures stated plainly.
