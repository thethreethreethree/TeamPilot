---
paths:
  - "**/*form*.tsx"
  - "**/*input*.tsx"
  - "**/*checkout*.tsx"
  - "**/*signup*.tsx"
  - "**/*login*.tsx"
  - "**/*contact*.tsx"
---

# Form rules

Forms are where careless UI becomes lost revenue — and a cramped keyboard, a
small target and a slow network make a phone form less forgiving than a desktop
one. The evidence here is unusually concrete.

## Field count is the variable that matters

Documented average cart abandonment is **70.22%** across 50 studies. The
average 2024 checkout carries **11.3 fields** where **8** would do — roughly
40% dead weight. Every field is more expensive on a phone: it is another turn on
a cramped soft keyboard, another chance to mistype under a thumb.

Abandonment reasons, excluding "just browsing" (which is 42% on its own):

| Reason | Share |
|---|---|
| Extra costs too high | 40% |
| Delivery too slow | 20% |
| Didn't trust the site with card details | 19% |
| Forced account creation | 18% |
| Checkout too long or complicated | 17% |
| Site errors or crashes | 17% |

**Optimise field count, not step count.** A one-page form with 14 fields is
worse than a three-step form with 8. Every field must justify itself: what
breaks if we don't ask?

## Layout

- **Single column.** Multi-column forms create an ambiguous reading order —
  the eye cannot tell whether to go across or down, and Gestalt proximity and
  continuity give conflicting answers. One controlled study (n=702) measured
  single-column completing 15.4s faster. On a phone this is nearly automatic;
  the mistake to avoid is cramming two full fields onto one narrow row.
- **The legitimate exception** is genuinely paired short fields on one row:
  City/State/ZIP, expiry month/year, first/last name. There the pairing *is*
  the grouping cue. "Single column" does not mean "one field per row, always".
- **Top-aligned labels.** Fastest for familiar data, and the only alignment
  that survives narrow viewports and long localised strings. On a phone,
  top-aligned is effectively mandatory — a label above the field keeps it
  visible when the keyboard rises.

## Keyboard, scroll and focus

The soft keyboard is part of the form. Get these wrong and the field the user is
typing into disappears behind the keyboard.

- Wrap the form in a `KeyboardAvoidingView` (or a keyboard-aware scroll view —
  **verify current**) so the focused `TextInput` stays visible above the
  keyboard.
- Set the right keyboard per field: `keyboardType` (`email-address`,
  `number-pad`, `phone-pad`), `autoCapitalize`, `autoCorrect={false}` for emails
  and codes, and `returnKeyType` with an `onSubmitEditing` that advances to the
  next field.
- Body inputs stay ≥16 so text is legible and comfortable under the thumb.

## Labels

Every input gets a **visible label** (a `<Text>` above the field) **and** an
`accessibilityLabel` on the `TextInput`. **A placeholder is never a label** — it
disappears on focus, sits below AA contrast by default, is exposed inconsistently
to assistive technology, and destroys error recovery. Float-label patterns
mitigate but do not fix the contrast and truncation problems.

Placeholders are for format examples only: `you@company.com`, `MM / YY`.

## Validation — "reward early, punish late"

This single rule prevents the most common form frustration:

- A field that has **never been valid**: wait until **blur** before showing an
  error. Flagging mid-typing reads as the form shouting at someone who hasn't
  finished.
- A field **already in an error state**: re-validate on **every keystroke** so
  the error clears the instant it is fixed.
- Fixed-length fields (postcode, card number, OTP) may validate as soon as the
  known length is reached.
- Clear errors immediately on correction. Stale errors make people doubt
  correct input.
- Confirm success visibly — a check state measurably reduces uncertainty.

> Do not cite "inline validation gives 22% fewer errors". That comes from an
> unpublished 22-person 2009 study. The direction is corroborated
> qualitatively; the numbers are not citable.

## Errors

Error messages must say **what went wrong and how to fix it** (WCAG 3.3.1,
3.3.3). Never apologise, never blame, never be vague.

```
✗  Invalid input.
✗  Sorry, something went wrong!
✓  Enter a date in the future — this card expired in 2023.
✓  That email is already registered. Sign in instead, or reset your password.
```

Errors carry **three** signals: token colour, an icon, and text. Never colour
alone. Expose the message to assistive tech via the field's
`accessibilityState={{ invalid: true }}` and an accessible error description
(`accessibilityLabel` / `accessibilityHint`, or a live-region announcement so
VoiceOver / TalkBack read it when it appears).

Put a summary at the top of long forms, with a way to jump to each failing
field.

## Autofill

Every field collecting information about the user declares the correct autofill
hint so the platform keychain / password manager and SMS autofill can fill it.
This is both an accessibility win and a measurable completion-rate improvement.

Use RN's cross-platform `autoComplete`, and set iOS `textContentType` where you
need the finer OS mapping (values are version-specific — **verify current**):

```
name · given-name · family-name · email · tel · organization
street-address · address-line1 · address-level2 · postal-code · country
cc-name · cc-number · cc-exp · cc-csc
username · current-password · new-password · one-time-code (sms-otp)
```

The OTP hint matters especially: `one-time-code` (iOS) / `sms-otp` (Android)
lets the platform surface the code from the messages app instead of making
people leave the app to transcribe it.

## Authentication (WCAG 3.3.8, AA)

No **cognitive function test** may be the only route through authentication.
Concretely:

- **Never block paste** in password or OTP fields (do not intercept
  `onChangeText` to reject a pasted value).
- Support the platform password managers and SMS autofill — correct
  `autoComplete` / `textContentType`, and never strip pasted content.
- No puzzle CAPTCHAs without an alternative.
- Do not require transcribing a code between two devices as the only option.
- Prefer platform biometrics (Face ID / Touch ID / Android biometric via
  `expo-local-authentication` — verify current) over re-typing a password.

## Redundant entry (WCAG 3.3.7, A)

Information already given in the same process is auto-populated or offered for
selection. Do not ask for an address twice because the second one is called
"billing".

## Accept what people type

Normalise server-side. Accept phone numbers with or without separators, card
numbers with or without spaces, dates in more than one format. Rejecting a
correct value because of its punctuation is a self-inflicted abandonment.

Input masks that fight the user are worse than no mask.
