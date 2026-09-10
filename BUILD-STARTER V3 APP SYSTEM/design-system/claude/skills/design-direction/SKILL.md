---
name: design-direction
description: Choose and justify an art direction for the app, so it does not default to the generic machine-generated look. Use after design-intake and before building anything. Also use when a build feels generic and needs a distinct visual point of view.
allowed-tools: Read Write Edit Glob Grep AskUserQuestion
---

# Design direction

## The problem this solves

Ask any generative system for "a beautiful modern app" and you get the same
screen: dark hero, purple-to-blue gradient, Inter, three rounded cards with
outline icons, a grey logo wall — sitting on an untouched Expo template. It is
competent and completely forgettable.

The reason is structural. Prototypicality — how typical something looks for its
category — is one of the strongest predictors of aesthetic rating in the
literature (η²p up to .81, comparable to or larger than visual complexity). A
model trained on a decade of UI produces the *maximally prototypical* screen. It
tests as "fine" and reads as nothing.

**Prototypicality is a floor, not a ceiling.**

## The synthesis this system uses

> **Conventional structure. Distinctive surface.**

Be prototypical where deviation costs comprehension:

- Tab-bar-plus-stack navigation, tabs visible, 3–5 destinations
- Platform-standard back and gestures (edge-swipe, predictive back)
- Controls and system chrome where the OS puts them
- Familiar form behaviour, familiar checkout, native pickers and sheets

Be distinctive where deviation costs nothing and buys memorability:

- Typography — the single highest-leverage differentiator
- Colour — hue, chroma discipline, and what you put it *on*
- Material and texture — grain, print artefacts, edges, weight
- Composition — asymmetry, scale contrast, deliberate emptiness
- Motion character — how things move, not how much

Award galleries and evidence-based UX are different disciplines with different
objective functions. Take **visual vocabulary** from award work; never take
**interaction architecture** from it.

## Choose a direction

Read `reference/11-art-directions.md` for the full library. Each entry has a
type pairing, colour logic, layout thesis, motion character, and — critically —
what it is *wrong* for.

Never pick one because it sounds appealing. Pick it because of what the intake
established: audience, category convention, content volume, tone.

Use `AskUserQuestion` to present **three** candidate directions with a genuine
tradeoff between them. Show, for each: what it signals, where it is strong,
what it costs. Let the user choose.

## Then write the justification

Add to `DESIGN-CONTRACT.md` under `## Direction`:

1. **The direction chosen**, by its id.
2. **Why this client** — tie it to two specific intake answers. "Technical mono
   because the audience is engineers evaluating an API, and because all three
   named competitors use soft rounded SaaS styling."
3. **The one bold move.** Every project gets exactly one place where it takes a
   real risk — an unusual display face, an extreme scale contrast, a saturated
   ground, a single orchestrated motion moment. Name it, and name where it goes.
4. **What stays quiet.** Boldness only reads if everything around it is calm.
   Name what you are deliberately keeping plain.
5. **The category convention you are breaking**, and why that is safe here.

## Divergence self-check

Before you finish, answer these honestly in the contract. If you cannot, the
direction is not specific enough yet.

- [ ] Would this design be obviously wrong for the competitor apps named in
      the intake? *(If it would work equally well for all of them, it is
      generic.)*
- [ ] Name three visual decisions that could only apply to this client.
- [ ] Is the display typeface something other than Inter, Poppins, Montserrat
      or Space Grotesk *(and other than the platform system font)*? *(Not because
      those are bad — because they are the default of the default.)*
- [ ] Is there a hero gradient? If yes, is it declared in the contract with
      OKLCH stops (resolved to hex for device) and a reason?
- [ ] If you removed the logo, would anyone be able to tell this apart from a
      stock Expo template?

## Hard bans

These are blocked by the linter and the gate. Each may be waived only with a
written reason in `waivers:`.

Purple-to-blue gradient hero · glassmorphism on large surfaces · bento grid as
the whole screen · outline-icon-in-rounded-square feature triplet · uniform grey
"Trusted by" logo wall · blob background shapes · kinetic typography hero ·
WebGL/3D hero as a centrepiece · auto-rotating carousel · emoji as icons ·
everything centred · Inter as the display face. Plus the app anti-patterns in
`reference/12-banned-patterns.md` — tiny touch targets, hover-only affordances,
nav hidden behind a drawer when a tab bar fits, blocking splash, ignored safe
areas, cold permission prompts.

Note the last one carefully: Inter is an excellent UI face and is fine for body
and interface text. It is banned as the **display** face because it carries no
voice — it is the typographic equivalent of a default.
