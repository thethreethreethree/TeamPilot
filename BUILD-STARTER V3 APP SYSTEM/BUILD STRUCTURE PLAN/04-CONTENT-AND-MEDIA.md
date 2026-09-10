# 04 — CONTENT AND MEDIA

Read before sourcing a single image or writing a line of interface copy.

---

## 1. The rule that governs everything here

> **Honest absence beats invented presence.**

A visible "not set yet" costs a moment of mild embarrassment. A fabricated
address, a stock photo passed off as the client's premises, or an invented
statistic costs the client's credibility — and it is the owner who wears it, not
you.

This is not squeamishness. In most service categories the *first thing* a careful
customer checks is whether the business appears to be real. Fabrication is
therefore not only dishonest, it attacks the exact signal the app exists to
establish.

---

## 2. Sourcing photography

**Do it early.** Photography is a dependency, not a finishing touch. Deferring it
means designing around an image slot whose contents you cannot predict, and then
rebuilding when the real ones arrive. If the client has no photographs, that is a
*direction-shaping fact* — a typography-led direction is a legitimate answer and
a far better one than a photo-led layout full of empty panels.

**Licence first, aesthetics second.** Use libraries whose licence explicitly
permits commercial use. Never pull images from a search engine, a competitor's
app, or a blog. Infringement lands on the client.

**Record the source of every asset** — file, identifier, licence, what it shows —
in a credits file beside the images. Attribution may not be required; traceability
always is, because "where did this come from" gets asked a year later.

**Look at every image before you assign it.** Do not assign from a text
description. This costs a few minutes and prevents the failure where a product
card shows a photograph of a pavement.

**Crop deliberately.** A portrait photograph cropped to a landscape slot loses its
subject. Store a crop anchor per asset and check the result — with the subject low
in frame, a centred crop shows the background and nothing else.

---

## 3. The line between atmosphere and evidence

Two categories, two standards.

**Atmosphere** — hero bands, section imagery, place and mood. Licensed library
photography is entirely legitimate. Nobody reads a hero image as a documentary
record.

**Evidence** — the specific product, the premises, the team, anything that
answers "is this real". Here a library photograph is a *misrepresentation*, and
the customer discovers it at the counter.

Where evidence photography does not yet exist:

- Use accurate imagery of the actual product type as clearly-labelled interim
  content, and record it as a launch blocker.
- Tell the owner plainly, in the owner/settings surface, that these must be
  replaced.
- Build the upload path so they can replace them **without you**. See
  `02-BACKEND-BLUEPRINT.md` §11.
- Never let interim content quietly become permanent because nobody was told.

---

## 4. Placeholder states

Every field the client has not yet supplied gets a state that is:

- **Honest** — says what is missing, not something invented
- **Actionable** — names where to fix it
- **Not shouted at the customer** — the customer-facing screens show a quiet,
  graceful absence; the *owner/settings surface* is where the alarm goes

Never render a fabricated address, phone number, testimonial, statistic or logo.
If proof does not exist yet, design the screen without it.

---

## 5. Interface copy

- Real copy only. Placeholder text hides the layout failures only real content
  reveals — the heading that wraps to three lines, the forty-character name, the
  empty category.
- Buttons say what happens. A label is a promise; match the confirmation to it.
- Headings carry the argument. Read them alone: they should be the outline.
- Errors say **what went wrong and how to fix it**. No apology, no blame, no
  vagueness.
- Empty states are the best teaching moment you get. Say what belongs there, why
  it is worth having, and give the action.
- Follow the voice recorded in the contract, including its anti-adjective. The
  anti-adjective does more work than the adjective.

---

## 6. Claims discipline

Anything the app *asserts* about the business is a promise the owner must keep.

Before writing a claim, sort it:

| Kind | Test | Example shape |
|---|---|---|
| **Verifiable in the app** | The app itself makes it true | "every price is shown in both currencies" |
| **Owner-confirmed** | They told you, and it is recorded | "delivery is free" |
| **Invented** | Neither | anything else — do not ship it |

Anything in the third column is fabrication regardless of how reasonable it
sounds. Anything in the second should be flagged for the owner to sign off,
because they are the one who has to honour it.

---

## 7. Generated imagery

Generated app icons, adaptive icons and store screenshots are good practice —
they cannot drift from the app the way a hand-exported file does. The same holds
for a share/link preview image the app produces for what it sends out.

Two things to know:

- The renderer does **not** read your stylesheet. It needs literal values; put
  them in the tokens file (see `03-DESIGN-BLUEPRINT.md` §2).
- It also does not automatically have your typeface, and will silently fall back.
  Either supply the font data or accept that the screenshot's weight will not
  match the app — and say which you chose rather than leaving it a surprise.

For the app icon, remember a wordmark is illegible at the size a home screen
renders it. One strong simple shape beats letterforms at icon size.
