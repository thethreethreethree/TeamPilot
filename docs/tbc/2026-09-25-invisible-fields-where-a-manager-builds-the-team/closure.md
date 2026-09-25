# CLOSURE — invisible fields where a manager builds the team

## What is true now

`/team` and both of its dialogs render correctly in both themes. All three files report **0**.
Sales Coach is at **27 across 11 files**, down from 45 an hour ago and from 80 this morning.

## The finding

Ten of this route's eighteen sites were in two DIALOGS, and they were **inputs**.

`bg-base` fields carrying a `border-white/10` edge, inside a `bg-surface` modal. On cream: flat
grey strips with no border on a white sheet. The Title and Password fields a manager types into to
create a team password; the Email field they type into to add a rep. **A field that does not look
like a field is a control a person does not know they can use.**

And the one I did not predict from source: the `Existing user` / `New user` segmented control, whose
track is `bg-white/[0.03]`. On cream only the ember active pill survived and the inactive half
floated with nothing around it — **the sixth time today the unselected state has disappeared while
the selected one remained.** That shape never looks broken. It looks like emphasis on the one that
works, which is exactly why six of them shipped.

## The decision inside the fix

The fields kept `bg-base`.

On dark that is ink-950 inside an ink-900 modal — a correct inset, a field sunk into the sheet.
`surface-raised` would have made it ink-800, **lighter than its parent**, inverting the hierarchy to
fix a light-mode symptom.

Only the edge was ever wrong. Yesterday's lesson was that `surface` on `surface` renders nothing;
this is its other half: **a fill that is correct in one theme is not evidence that the fill is the
defect.** The reflex — see white-alpha, substitute the nearest token — treats one class string as
one decision when it is several.

## Residual

```json
[
  {
    "id": "R1-27-remain-and-two-of-them-matter",
    "item": "kpi/page.tsx 7, VoiceEnrollment 5, then nine files with 1-2 each. Two of roleplay's are the deliberate bg-brand-shell composer and should stay.",
    "why_skipped": "One route at a time.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-25T03:37:55Z",
    "outcome": "OPEN. `/kpi` is the last unrendered route with real weight; VoiceEnrollment is mounted from Settings, which was rendered, so its five were below the captured fold."
  },
  {
    "id": "R2-both-dialogs-captured-in-one-state-each",
    "item": "`team-passwords` was shot with 'No team passwords yet', so the password ROWS and their copy/delete controls are unrendered. `AddAgentDialog`'s 'New user' tab carries a third input and was not switched to.",
    "why_skipped": "Each needs an interaction or a populated fixture.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T03:37:55Z",
    "outcome": "OPEN, and it is the branch lesson again in a smaller frame: I fixed by pattern across the whole file and photographed one of its states. The fixes in the unrendered halves are 'fixed by pattern, unseen'."
  },
  {
    "id": "R3-three-routes-never-rendered",
    "item": "/kpi, /team-chat, /door.",
    "why_skipped": "Two are thin wrappers; /kpi is 909 lines.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-25T03:37:55Z",
    "outcome": "OPEN. /kpi next."
  },
  {
    "id": "R4-the-founders-other-errors",
    "item": "Still unnamed. The backfill fix is deployed and waiting on a button press.",
    "why_skipped": "No evidence beyond the one screenshot.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-25T03:37:55Z",
    "outcome": "OPEN. Today's work is a partial answer either way: if what he is seeing is the module looking wrong in light mode, 53 sites have been closed since he said it."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed.
Six captures plus four crops were generated from this project's own components into
`artifacts/visual/` (git-ignored) and each was opened and described.

Still unopened: six of the seven PDFs in `docs/SYSTEM UPDATES AND REVISION 09-22-2026/`, the 16
images in `public/`, the 11 in `docs/sales-coach/webstore-promo-kit/assets`, the two WhatsApp
JPEGs, three Sales Coach routes, two of DoorLog's four states, `RepActivity`, the `captureStalled`
warning, and the two dialog states named in R2.
