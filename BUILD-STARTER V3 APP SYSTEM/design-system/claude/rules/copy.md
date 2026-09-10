---
paths:
  - "**/*.tsx"
  - "**/*.mdx"
  - "**/content/**"
---

# Copy rules

Words are design material. Most "the layout feels off" problems are actually
copy problems — a heading that says nothing, a button that hides what it does.

## Write from the reader's side of the screen

Name things the way the person recognises them, not the way the system is
built.

```
✗  Configure webhook endpoints        ✓  Choose where we send alerts
✗  Entity resolution failed           ✓  We couldn't find that order
✗  Utilise our platform               ✓  Use it
✗  Submit                             ✓  Create account
```

## Buttons say what happens

A control's label is a promise. Match the confirmation to it.

```
Button: "Publish"     → toast: "Published"
Button: "Delete file" → dialog: "Delete report.pdf?" → toast: "Deleted"
```

Never "Submit", "OK", "Tap here", or "Learn more" alone. A screen-reader user
swiping through controls hears the labels out of context — every one must make
sense alone (it is also the control's `accessibilityLabel`).

## Headings carry the argument

If someone reads only the headings, they should get the point. Headings that
work as a standalone outline are also what makes a page skimmable, which is
how people actually read.

```
✗  Our Features · Why Us · Get Started
✓  Ships in a week, not a quarter · Your data stays yours · See it on your own site
```

## Length

- Body paragraphs: 2–4 sentences. Break longer ones.
- Measure ≤ 75 characters.
- Front-load. The first three words carry the scent that decides whether the
  rest gets read.

## Errors and empty states

**Errors** explain what went wrong and how to fix it. No apologies, no blame,
no vagueness. See `forms.md`.

**Empty states** are not decoration — they are the best teaching moment in the
product. Say what belongs here, why it's worth having, and give the action.

```
✗  No items found.
✓  No invoices yet
   Invoices appear here once you've been paid through the platform.
   [ Create your first invoice ]
```

## Never ship

- **Lorem ipsum** in a committed file. Placeholder text hides the layout
  failures only real content reveals — the heading that wraps to three lines,
  the name that's 40 characters long, the empty category.
- Invented statistics, fake testimonials, or logo walls for clients who are
  not clients. If real proof does not exist yet, design the page without it.
- Copy that promises something the product does not do.

## Tone

Follow the `voice` field in `DESIGN-CONTRACT.md`. If it says "plain and
direct", that overrides any instinct toward marketing register.

Default when unspecified: clear, concrete, no hedging, no exclamation marks,
no "simply" or "just" (they imply the reader should have found it easy), and
no em-dash-heavy breathless rhythm.

## Accessibility of language

- Expand an acronym on first use.
- Control and link text describes the destination or outcome, not the act of
  tapping.
- Do not rely on spatial language alone ("the button on the right") — it is
  meaningless in a screen reader and wrong across device sizes and orientations.
- Write dates unambiguously: `12 March 2026`, not `12/03/26`.
