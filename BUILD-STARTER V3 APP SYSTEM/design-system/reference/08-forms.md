# Forms

The one area where careless UI is directly measurable as lost revenue — and a
phone form is harder than a desktop one: a small soft keyboard, thumb typing, and
a keyboard that covers half the screen. Every principle below matters *more* here.

## Field count is the variable

Documented average cart abandonment: **70.22%** across 50 studies. The average
2024 checkout carries **11.3 fields** where **8** would do — roughly 40% dead
weight. Typing is the tax, and on a phone keyboard the tax is higher.

Abandonment reasons, excluding "just browsing" (42% on its own):

| Reason | Share |
|---|---|
| Extra costs too high | 40% |
| Delivery too slow | 20% |
| Didn't trust the app with card details | 19% |
| Forced account creation | 18% |
| Checkout too long or complicated | 17% |
| App errors or crashes | 17% |
| Unsatisfactory returns policy | 13% |
| Couldn't see total cost upfront | 12% |

**Optimise field count, not step count.** A single long screen with 14 fields is
worse than a three-step flow with 8. Do not chase "one-screen checkout".

Test for every field: what breaks if we do not ask? On device, prefer the OS to
supply data (autofill, saved cards, platform pay) over asking for it.

## Layout

**Single column, always.** A phone form is one column by nature — do not fight it
with side-by-side fields that shrink both. Multi-column creates an ambiguous
reading order; one controlled study (n=702) measured single-column completing
15.4s faster.

**The legitimate exception:** genuinely paired short fields on one row — expiry
month/year, first/last name — where the pairing is itself the grouping cue.

**Top-aligned labels.** Fastest for familiar data, and the only alignment that
survives a narrow screen and long localised strings. The label sits **above** the
field so it stays visible when the keyboard is up and the field is focused.

## Labels

Every input gets a **visible label above the field**, and the same text as its
`accessibilityLabel` so VoiceOver / TalkBack announce it.

**A placeholder is never a label.** `placeholder` text disappears the moment
typing starts, defaults to a low-contrast `placeholderTextColor`, is announced
inconsistently, and destroys error recovery — the field goes blank and the user
no longer knows what it was. Float-label patterns mitigate but do not fix it.

Placeholders are for **format examples**: `you@company.com`, `MM / YY`.

## The keyboard

The right keyboard removes taps and errors before they happen.

- **`keyboardType`** matched to the field: `email-address`, `numeric`,
  `number-pad`, `decimal-pad`, `phone-pad`, `url`.
- **`autoCapitalize`** and **`autoCorrect`** off for emails, usernames, codes and
  anything that is not prose — autocorrect mangling an email is self-inflicted
  abandonment.
- **`returnKeyType`** reflects the next action (`next`, `go`, `done`), and
  **`onSubmitEditing`** moves focus to the next field (via a `ref`) or submits —
  so the user can run the whole form from the keyboard without reaching back to
  the screen.
- **`KeyboardAvoidingView`** (plus scrolling the focused field into view) so the
  soft keyboard never covers the field being typed into — the device equivalent
  of WCAG 2.4.11. Test on a small screen where the keyboard eats the most space.

## Validation — "reward early, punish late"

The single most useful rule here:

- A field that has **never been valid**: wait until **blur**. Flagging mid-typing
  reads as the form shouting at someone who has not finished. The dominant failure
  mode.
- A field **already in an error state**: re-validate on **every keystroke**, so
  the error clears the instant it is fixed.
- Fixed-length fields (postcode, card number, OTP) may validate on reaching the
  known length.
- **Clear errors instantly** on correction. Stale errors make people doubt
  correct input.
- **Confirm success visibly.** A check state measurably reduces uncertainty and is
  spontaneously praised in testing.

## Errors

Say **what went wrong and how to fix it** (WCAG 3.3.1, 3.3.3). No apologies, no
blame, no vagueness.

```
✗  Invalid input.
✗  Sorry, something went wrong!
✓  Enter a date in the future — this card expired in 2023.
✓  That email is already registered. Sign in instead, or reset your password.
```

Three signals, always: token **colour**, an **icon**, and **text**. Never colour
alone. Put the error text next to the field, and fold it into the field's
accessibility label/hint so the screen reader announces the field *as invalid,
with the reason* when focus lands on it — RN has no `aria-describedby`, so the
association is something you build.

A long form gets a summary at the top listing each failing field, each tappable to
focus that field.

3.3.3 has one exception: suggestions may be withheld where they would jeopardise
security — which is why login forms say "username or password incorrect".

## Autofill

Every field collecting information about the user declares its autofill hints, so
the OS and password managers can fill it. On device this is **two props**, because
the platforms differ:

- **iOS: `textContentType`** — `emailAddress`, `name`, `givenName`, `familyName`,
  `telephoneNumber`, `fullStreetAddress`, `postalCode`, `username`, `password`,
  `newPassword`, `oneTimeCode`, and the card types (`creditCardNumber`).
- **Android: `autoComplete`** — `email`, `name`, `tel`, `street-address`,
  `postal-code`, `username`, `password`, `new-password`, `sms-otp`,
  `cc-number`, `cc-exp`.

Set both. `oneTimeCode` / `sms-otp` matters especially: it lets the platform fill
the SMS code from the notification instead of making people leave the app to read
it and transcribe it back.

## Authentication (WCAG 3.3.8, AA)

No **cognitive function test** may be the only route through authentication.

- **Never block paste** in password or OTP fields — it defeats password managers,
  which the criterion explicitly protects.
- Support password managers and platform autofill: correct `textContentType` /
  `autoComplete`, and use `secureTextEntry` for passwords (with a show/hide toggle
  — never trap the user typing a long password blind).
- Prefer platform biometric / passkey sign-in where available over re-typing.
- No puzzle CAPTCHA without an alternative; never require transcribing a code
  between two devices as the only option.

## Redundant entry (WCAG 3.3.7, A)

Information already given in the same flow is auto-populated or offered for
selection. Do not ask for an address twice because the second one is labelled
"billing". Offer a "same as…" toggle.

## Accept what people type

Normalise on the server. Accept phone numbers with or without separators, card
numbers with or without spaces, dates in more than one format. Rejecting a correct
value over its punctuation is self-inflicted abandonment. Input masks that fight
the user are worse than no mask.
