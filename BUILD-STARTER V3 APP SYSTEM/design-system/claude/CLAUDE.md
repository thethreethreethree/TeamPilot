# Design law for this project

> **Where this sits.** This is the *design law* layer of a four-layer build system:
>
> ```
> LAW         01-CONSTITUTION.md · 03-ANTI-FAULT.md      how to reason
> METHOD      BUILD STRUCTURE PLAN/                      how a build runs
> DESIGN LAW  this file + tools/ + .claude/              ← you are here
> CODE        BUILD STRUCTURE PLAN/foundation/           what you start from
> ```
>
> The supreme law is the BUILD-STARTER constitution (`01-CONSTITUTION.md`) plus
> `03-ANTI-FAULT.md`; this file governs *design decisions only* and is subordinate to
> them — if anything here ever conflicts with the constitution, the constitution wins.
> The build sequence, the backend shape, the deployment method and the handover gate
> are **not** here — they are in `BUILD STRUCTURE PLAN/`, and its
> `01-BUILD-SEQUENCE.md` is what tells you which phase you are in.
>
> **Path note:** those files ship inside the starter kit folder, so from a project
> root the path is `BUILD-STARTER V3 APP SYSTEM/BUILD STRUCTURE PLAN/…` unless you
> moved them. If a reference below does not resolve, look there before assuming
> the file is missing.
>
> These design rules are **fixed like the constitution: you do not amend them
> mid-build** (anti-fault rule 1). Adding a token to `theme.ts` is normal work;
> rewriting *these rules* or the gate scripts is the bureaucracy failure — don't.

This file is loaded automatically at session start and re-injected after every
compaction. It is deliberately short. The full manual is
`Master-Design-Guide-line.Md`; detail loads on demand from `.claude/rules/`
and the `/design-*` skills.

**These rules override your defaults and any habit from other projects.**
They are enforced by hooks, not trust: violating writes are blocked, and the
Stop hook prevents you ending a turn on a failing gate.

---

## The order of work — never skip a step

```
1  /design-intake      → DESIGN-CONTRACT.md      (no UI code may exist before this)
2  /design-direction   → art direction chosen and justified
3  scaffold            → Expo (React Native + TypeScript) + NativeWind, then
                         BUILD STRUCTURE PLAN/foundation/install.sh
4  /design-tokens      → theme.ts + NativeWind tokens, contrast-verified
5  build               → components, then screens
6  /design-review      → audit against the guide
7  /design-ship        → all gates green, release report written
```

You may not write a `.tsx` / `.jsx` screen or component before step 1 exists.
The PreToolUse hook will refuse.

Step 3 is the seam with the method layer. Scaffold the Expo app before tokens, and
install the foundation after the scaffold (its files land into the project structure —
`app/`, and the `metro` / `babel` / `tailwind` config — that the scaffold creates).
The foundation's templates lint clean against these rules, so landing them before the
theme exists does not turn a gate red. Full reasoning:
`BUILD STRUCTURE PLAN/01-BUILD-SEQUENCE.md` Phase 3.

---

## Non-negotiables

**Tokens.** Colour, spacing, type size and radius come only from tokens — the
generated `theme.ts` and NativeWind classes. No hex, `rgb()` or `hsl()` literals in
a `style={{}}` or `StyleSheet`, and no arbitrary NativeWind values (`p-[13px]`,
`text-[15px]`). If a value does not exist, regenerate the theme from the contract —
do not inline it.

**Focus.** Never remove the accessibility focus indicator. Keyboard, switch-control
and external-keyboard users need a visible focus state; touch is not the only input.

**Targets.** No interactive control below **44pt (iOS) / 48dp (Android)**. Use
`hitSlop` where the visible element is smaller than the touch area.

**Labels.** A placeholder is not a label. Every `TextInput` gets a visible label
and an `accessibilityLabel`.

**Navigation.** Primary navigation is a **tab bar (3–5 destinations)** or a clearly
labelled menu — never hidden behind a gesture or an unlabelled icon. Hidden
navigation measurably destroys findability; this is not a style preference.

**Reading.** Body text ≥ 16 and honour Dynamic Type / `fontScale`. Measure ≤ 75
characters. Line-height ≥ 1.5.

**Emphasis.** One primary action per screen. Distinctiveness is relational: five
emphasised elements means none are.

**States.** Every interactive element ships rest, press/active, focus, disabled and
loading. Hover is pointer-only — never make it the sole affordance. A component
without its states is not finished.

**Motion.** Must carry meaning and must respect **Reduce Motion**
(`useReducedMotion` / `AccessibilityInfo.isReduceMotionEnabled`).

**Content.** Real copy only. Lorem ipsum in a committed file is a defect — it
hides the layout failures that only real text reveals.

---

## Banned outright

Purple-to-blue gradient heroes · glassmorphism on large surfaces ·
auto-rotating carousels · emoji as interface icons ·
outline-icon-in-rounded-square feature triplets · Inter as the display face ·
**hover-dependent affordances** (there is no hover on touch) ·
**touch targets below 44pt / 48dp** · **ignoring safe-area insets**.

Each may be waived only by an explicit entry under `waivers:` in
`DESIGN-CONTRACT.md`, with a written reason. Adding a waiver you cannot
justify to the user is a violation in itself.

---

## Stack rules (2026)

- **NativeWind (Tailwind for React Native)** — style via `className`; tokens live
  in the generated `tailwind.config` + `theme.ts`. NativeWind *requires* a
  `tailwind.config` (unlike web Tailwind v4), and its babel/metro setup is
  version-specific — **(verify current)** against your NativeWind version.
- **Semantic tokens only** — `bg-primary`, `text-primary-foreground`. Never reach
  past them into a raw palette hex.
- **Expo + expo-router** — file-based routing under `app/`. Use `expo-image` for
  images (caching, priority) and `expo-font` for fonts. Router param/hook shapes
  are version-specific **(verify current)**.
- **Animation** — `react-native-reanimated` + `react-native-gesture-handler`; keep
  animation off the JS thread and respect Reduce Motion.
- **Colour** — token-gen authors ramps in `oklch()` for perceptually even steps,
  then emits **hex** to `theme.ts` because React Native cannot parse `oklch()`.

---

## Before you say you are done

```bash
node tools/gate.mjs        # static gates (contract, lint, theme contrast, typecheck)
```

The **runtime gate is a real-device check, not a browser one** — a React Native app
is verified on a device / simulator, and an automated device audit needs a harness
(Detox / Maestro) **(verify current)**. A skipped device check is not a pass: run the
core flow on a real iOS and Android device, and if you cannot, say so plainly rather
than implying the build is verified.

**Never** edit `tools/rules.json` or `.claude/hooks/` to make a gate pass.
That is the one action this system treats as tampering, and those paths
require human approval for exactly that reason.

---

## How decisions reach the owner

**Every decision that is the owner's comes to them as options with your
recommendation marked** — not prose ending in a question, and never a choice you
make silently on their behalf. Give the real trade for each option, put your
recommendation first, and say why in one sentence.

This applies to actions as much as decisions: which fix to apply, what to build
next, how far to take something, what to leave out. It applies **mid-flow**, not
only at checkpoints — momentum is when it gets dropped. It applies to your own
corrections: if you got something wrong and there are several ways to put it
right, that choice is theirs.

"You decide" is not a recommendation. Surface the choice *with* your best answer.

> This rule lives here, in the file re-injected after every compaction, because
> the same instruction given once at the start of a long session gets summarised
> away and then forgotten. That has already happened once.

## When "all" means all

When the owner asks for *every* instance of something to be handled, **enumerate
it mechanically before designing** — sweep the filesystem, the imports, the
generated routes. A set you reasoned about contains what you thought of; a set you
swept for contains what is there. Show them the inventory so they can see it is
complete rather than trust that it is.

## Look at anything visual before calling it done

A clean build and a green simulator prove the code ran. They cannot show you that a
generated image is rendering a raw translation key, or that a tab-label row is
clipping at the screen edge while the layout checker reports no overflow. If a human
will look at it, look at it once yourself.

## When a request conflicts with these rules

Say so, name the rule, and propose a compliant alternative that achieves what
the user actually wants. Do not silently comply and break the rule, and do not
refuse without offering a route forward.

@.claude/rules/README.md
