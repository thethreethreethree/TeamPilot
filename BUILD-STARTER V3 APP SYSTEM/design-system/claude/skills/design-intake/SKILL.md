---
name: design-intake
description: Interview the user and produce DESIGN-CONTRACT.md — the binding brief that every later design decision derives from. Use at the very start of any app project, before writing any UI code. Also use when an existing project has no contract, or when the brand, audience or purpose has changed.
argument-hint: "[project name]"
allowed-tools: Read Write Edit Glob Grep AskUserQuestion
---

# Design intake

You are producing `DESIGN-CONTRACT.md` at the project root. Nothing visual gets
built before it exists — the PreToolUse hook enforces this.

The contract exists to solve one specific problem: **without it, every project
converges on the same default.** Generative tools regress toward the mean of
their training data, and the mean of the last decade of the web is a purple
gradient, Inter, and cards on white. The contract is what forces a decision
that could only apply to *this* client. On device the default has a second face —
a stock Expo template with the system font and untouched platform chrome — and
the contract is what forces the app off it too.

## Rules for this interview

- **Ask. Do not assume.** Use `AskUserQuestion` for anything that changes the
  design. Guessing here is what produces the generic result.
- Ask in **small batches** — 3–4 questions at a time, then react to the answers.
- If the user gives you brand assets (a logo, an existing site, a palette),
  read them first and lead with what you found, so they correct you rather
  than start from nothing.
- Never fill a placeholder yourself to get past the gate. An unfilled `<LIKE
  THIS>` placeholder fails gate G1 deliberately.

## What you must establish

### 1. The business, in one sentence

Not what they sell — what changes for the customer. Push past marketing
language until you get something concrete and falsifiable.

### 2. Audience

Who is this for, which platforms and devices (iOS/Android, phone/tablet, older
low-end hardware?), what do they know already, and what is their state of mind
when they open the app? A B2B procurement lead comparing three vendors and a
person panic-searching for an emergency plumber need opposite apps.

### 3. The single job of the app

One primary conversion — the thing a session is *for*. If they name three, ask
which one they would keep if they could only have one. Multiple co-equal goals is
how a screen ends up with five competing CTAs and no hierarchy.

### 4. Competitive position

Ask for 2–3 competitor apps and **what they dislike** about them. The dislikes
are more useful than the likes — they define the space to move into.

Also ask: what do all apps in this category look like? You need to know the
category convention before you decide how far to move from it.

### 5. Brand inputs

- Existing logo? Read it. Extract the actual colour rather than guessing.
- Existing typeface? Identify it if you can.
- Any colour that is off-limits (a competitor's, a bad association).
- Tone: how should this sound? Ask for two adjectives and one anti-adjective
  ("confident but never slick").

### 6. Content reality

The single most useful question, and the one most often skipped:

> **How much real content will exist on launch day?**

A design built for twelve case studies collapses with two. Ask for the actual
counts: how many products, testimonials, team members, posts, images. Design for
the real number, not the aspirational one.

### 7. Constraints

Target platforms and minimum OS versions, locale and language, RTL, offline
behaviour, native capabilities and permissions needed (camera, location,
notifications, biometrics), accessibility obligations beyond WCAG 2.2 AA,
performance targets (including low-end devices), backend/CMS, store-submission
deadline.

## Then write the contract

Use `templates/DESIGN-CONTRACT.template.md` as the exact structure. Fill every
field. Where the user genuinely has no preference, write your recommendation
**and mark it** `(assumed)` so it can be challenged later.

The frontmatter is machine-read by `token-gen.mjs`, the hooks and the gate.
Keep its keys and shapes exactly as templated — prose belongs in the body.

## Finally

1. Show the user a short summary — direction, colour, type, the one job — and
   ask them to confirm or correct it. Do not proceed on silence.
2. Tell them the next step is `/design-direction`.

Do **not** generate tokens or write any component in this skill. One step at a
time is what keeps the decisions visible.
