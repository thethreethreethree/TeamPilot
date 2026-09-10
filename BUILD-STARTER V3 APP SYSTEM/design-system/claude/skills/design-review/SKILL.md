---
name: design-review
description: Audit the current build against the Master Design Guide Line and report what fails, with specific fixes. Use before shipping, after a large batch of UI work, or whenever the user asks whether the design is good, finished, accessible, or on-brand.
allowed-tools: Read Bash Glob Grep Agent
---

# Design review

Run the machine checks first, then review what machines cannot see. Automated
tooling catches roughly a **third** of WCAG failures — a green axe run is
necessary and never sufficient. Do not report a passing gate as a passing
design.

## 1. Machine gates

```bash
node tools/gate.mjs
```

The static gate checks what it can from source. But the checks that matter most
on device — safe-area/clipping, real tap-target sizes, press and focus states,
screen-reader order — can only be seen with the app **running on a simulator or
device**, on both iOS and Android (verify how the adapted gate is invoked against
a booted app). A green static gate is necessary and never sufficient.

## 2. Independent audit

Delegate to the `design-auditor` subagent so the review is not done by the same
context that wrote the code. Self-review is systematically blind to its own
intent.

> Use the design-auditor subagent to audit the current build against
> DESIGN-CONTRACT.md and reference/12-banned-patterns.md.

## 3. What you must judge yourself

Machines cannot see these. Go through them explicitly and answer each.

**Hierarchy.** Squint at each screen. Do the three most important things stand
out in the intended order? If everything is emphasised, nothing is.

**The one-primary rule.** Count emphasised elements per screen. More than one
primary action means the screen has no opinion about what to do next.

**Information scent.** Read only the tab labels and screen titles. Could someone
predict what is behind each one? Invented brand vocabulary in navigation is the
most common failure.

**Orientation.** Open a screen cold, as a deep link would. Can you tell where you
are and how to get back?

**Content reality.** Does the layout hold with the *real* content counts from
the intake — two case studies, not twelve? Test the longest plausible heading,
the longest name, the empty state.

**Direction fidelity.** Open `DESIGN-CONTRACT.md`. Is the declared direction
actually visible in the build, or did it drift back toward the default?

**The template test.** Remove the logo. Is this distinguishable from a
template? If not, the direction was never applied.

**Copy.** Read every button label out of context. Read the headings alone as an
outline. Is there any lorem ipsum, any invented statistic, any placeholder?

**States.** Exercise every interactive element: press it (is there immediate
feedback?), disable one, trigger an error, load a slow view, empty a list. Walk
the screen with VoiceOver and TalkBack. Any missing state is an unfinished
component.

**Targets and reach.** Are the touch targets ≥44pt/48dp? Do adjacent ones have
room between them? Is the primary action reachable, and does content clear the
safe area?

**Motion.** Turn on Reduce Motion at the OS level and relaunch. Does anything
still move?

## 4. Report

Order findings by severity, and be specific enough to act on:

```
BLOCKING   file:line   rule   what is wrong   the fix
WARNING    file:line   rule   what is wrong   the fix
JUDGEMENT  where       what weakens the design   what to do instead
```

State plainly which gates were **skipped** and what that leaves unverified.
Never imply a build is verified when it was not exercised on device — and say on
which platforms (iOS, Android) and screen sizes it was, since a clean run on one
proves little about the other.
